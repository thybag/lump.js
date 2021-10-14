const jsPathRegex = /([^[.\]])+/g;

/**
 * Basic model to watch data. Will fire events on changed parts of data tree.
 *
 * @param {object} _data - Initial data for model to hold.
 */
const Model = function(_data) {
    const parent = this;

    // clone the data to keep it safe/clean
    _data = this.copy(_data);

    // Cache data access/edit
    const _cache = new WeakMap();
    const _original = this.copy(_data);

    // Live data proxy
    const _real = newDataProxy(_data, '');

    // Eventing
    this._events = {};
    this._subscribers = [];

    // Private methods

    /**
     * _get value from real store
     *
     * @param  {[type]} key      [description]
     * @param  {[type]} fallback [description]
     * @return {[type]}          [description]
     */
    function _get(key, fallback = undefined) {
        if (!key) return _real;

        const keyArray = Array.isArray(key) ? key : key.match(jsPathRegex);

        const result = (
            keyArray.reduce((prevObj, key) => prevObj && prevObj[key], _real)
        );

        if (result === undefined) return fallback;
        return result;
    }

    /**
     * _set value on real object in store
     *
     * @param {string} key      Object path using dot or array notation.
     * @param {[type]} value [description]
     * @return {boolean} sucess
     */
    function _set(key, value) {
        // Get key path
        const keyArray = Array.isArray(key) ? key : key.match(jsPathRegex);
        // Setup vars
        let base = _real;
        let insert; let insertLocation;

        // Ensure its a clean copy
        if (parent.isObject(value)) {
            value = parent.copy(value);
        }

        // Iterate object
        for (let i = 0; i < keyArray.length; i++ ) {
            if (i === keyArray.length - 1) {
                base[keyArray[i]] = value;
            } else {
                // If we need to create new objects as we walk the path, we need to
                // do this in a new object rather than updating the existing tree directly.
                // This is so that we avoid fireing duplicate update events after each nested
                // object is added, and instead attach the object all in one go.
                if (base[keyArray[i]] === undefined) {
                    // If we start building a new tree, track where we need to reinsert
                    if (!insertLocation) {
                        insertLocation = [base, keyArray[i]];
                        insert = base = {};
                    }
                    base[keyArray[i]] = {};
                }

                // Get next level
                base = base[keyArray[i]];
            }
        }

        // If we've build an external object, inject it into the model again
        if (insertLocation) {
            const [location, key] = insertLocation;
            location[key] = insert[key];
        }

        return true;
    }

    /**
     * Apply data changes
     * @param  {[type]} ctx [description]
     */
    function applyChanges(ctx) {
        // Detect changes to data, fireing events as needed.
        const change = parent.detectChanges(ctx.split('.'), _original, _data);

        // Update internal data cache to match
        if (change !== 'NONE') {
            parent.commitChanges(ctx.split('.'), _original, _data);
            parent.trigger('updated');
        }
    }

    /**
     * Create watcher proxy to manage each object in model
     * Provides access to get,set,on helpers + wraps access in proxies
     * in order to allow for dynamic change detection
     *
     * @param  {object} result  data to wrap in proxy
     * @param  {string} context datapath to current object
     * @return {Proxy}          Object wrapped in Proxy
     */
    function newDataProxy(result, context) {
        const proxyTraps = {
            get(obj, prop, receiver) {
                // Get real data from object
                const result = Reflect.get(obj, prop);

                // Return primitive or data wrapped in proxy
                return parent.isObject(result) ? newDataProxy(result, getContext(context, prop)) : result;
            },
            set(obj, prop, value) {
                // Update local object
                const success = Reflect.set(obj, prop, value);

                // Trigger change detection and sync to original
                applyChanges(getContext(context, prop));

                return success;
            },
            deleteProperty(obj, prop) {
                const success = Reflect.deleteProperty(obj, prop);
                applyChanges(getContext(context, prop));
                return success;
            },
        };

        // Config proxy or get from cache
        const resultProxy = _cache.get(result) || new Proxy(result, proxyTraps);
        _cache.set(result, resultProxy);
        return resultProxy;
    }

    /**
     * Create accessor proxy to manage access to data model
     * Holds a context data-path, which is then uses to get/set
     * data from the store.
     *
     * This approach means that stored re fences in code will never
     * become out of data, or become orphaned from the store
     *
     * @param  {string} context datapath to current object
     * @return {Proxy}          Object wrapped in Proxy
     */
    function newAccessProxy(context = '') {
        const proxyTraps = {
            get(obj, prop, receiver) {
                // Handle magic methods for object
                if (prop === 'get') return delegatedGet(parent, context);
                if (prop === 'set') return delegatedSet(parent, context);
                if (prop === 'on') return delegatedOn(parent, context);
                if (prop === 'off') return delegatedOff(parent, context);
                if (prop === 'trigger') return delegatedTrigger(parent, context);
                if (prop === 'getEvents') return delegatedEvents(parent, context);
                if (prop === 'getContext') return () => context;

                // Subscriptions currently only available on root model.
                if (context === '') {
                    if (prop === 'subscribe') return delegatedSubscribe(parent, context);
                    if (prop === 'unsubscribe') return delegatedUnsubscribe(parent, context);
                }

                // Support json stringify by pass access to the real object
                if (prop === 'toJSON') return () => _get(context);

                // Can this object be iterated?
                if (prop === Symbol.iterator) {
                    return _get(`${context}`)[Symbol.iterator];
                }

                // else treat this as an actual read event
                return parent.get(getContext(context, prop));
            },
            set(obj, prop, value) {
                // Set data to the context path
                return parent.set(getContext(context, prop), value);
            },
            ownKeys() {
                return Object.keys(_get(context));
            },
            getOwnPropertyDescriptor() {
                return {configurable: true, enumerable: true, value: '123'};
            },
            has(obj, prop) {
                /* eslint-disable no-prototype-builtins */
                // We don't know the type of the souce object
                // so have to blindly pass this down
                return _get(context).hasOwnProperty(prop);
            },
            deleteProperty(target, prop) {
                target = _get(context);
                return Reflect.deleteProperty(target, prop);
            },
        };

        // Return access proxy
        return new Proxy({}, proxyTraps);
    }

    /**
     * Get data from the store
     *
     * @param  {[type]} key      [description]
     * @param  {[type]} fallback [description]
     * @return {primitive|accessProxy}          [description]
     */
    this.get = (key = '', fallback = undefined) => {
        const result = _get(key, fallback);

        // Read events
        parent.trigger('read' + (key ? `:${key}` : ''));
        parent.trigger('read', key);

        return (parent.isObject(result)) ? newAccessProxy(key) : result;
    };

    /**
     * Set data to the store
     * @param  {[type]} key   [description]
     * @param  {[type]} value [description]
     * @return {[type]}       [description]
     */
    this.set = (key, value) => _set(key, value);

    // get data
    this.data = this.get();
};

/**
 * Trigger event on model
 *
 * @param  {[type]}    event [description]
 * @param  {...[type]} args  [description]
 */
Model.prototype.trigger = function(event, ...args) {
    // Fire own event
    for (const i of this._events[event] || []) {
        // Trigger event (either func or method to call)
        if (typeof i[1] === 'function') {
            i[1](...args);
        } else {
            this[i[1]](...args);
        }
    }

    // Fire listeners
    for (const [subscriber, ns] of this._subscribers) {
        // Optionally namespace listener.
        // e.g. players:update:name
        const namespace = ns ? ns + ':' : '';
        subscriber.trigger(namespace + event, ...args);
    }
};

/**
 * getEvents
 *
 * @param  {string} event [description]
 * @return {[type]}     [description]
 */
Model.prototype.getEvents = function(event) {
    return event ? this._events[event] : this._events;
};

/**
 * Listen for event on model
 * @param  {string} key    Object path using dot or array notation.
 * @param  {[type]} method [description]
 * @return {[type]}        [description]
 */
Model.prototype.on = function(key, method) {
    if (typeof method !== 'function') {
        throw new Error('Invalid listener callback provided.');
    }

    (this._events[key] = this._events[key] || []).push([key, method]);
    return this;
};

/**
 * Remove event listener
 * @param  {string} key    Object path using dot or array notation.
 * @param  {[type]} method [description]
 * @return {[type]}        [description]
 */
Model.prototype.off = function(key, method) {
    if (!this._events[key]) return this;

    // Delete all listeners if no method
    if (!method) {
        delete this._events[key];
        return this;
    }
    // Else only one with method
    for (const evt in this._events[key]) {
        if (this._events[key][evt][1] == method) {
            this._events[key].splice(evt, 1);
        }
    }

    return this;
};

/**
 * Register self as an external listener for model events
 * @param {[type]} subscriber [description]
 * @param {[type]} namespace [description]
 * @return {object} model
 */
Model.prototype.subscribe = function(subscriber, namespace = '') {
    if (typeof subscriber.trigger !== 'function') {
        throw new Error('Unsupported listener type provided. Must implement trigger method.');
    }
    this._subscribers.push([subscriber, namespace]);
    return this;
};
/**
 * Remove self as an external listener for model events
 * @param {[type]} subscriber [description]
 * @param {[type]} namespace [description]
 * @return {object} model
 */
Model.prototype.unsubscribe = function(subscriber, namespace = '') {
    this._subscribers = this._subscribers.filter(([sub, ns]) => {
        return !(ns === namespace && sub === subscriber);
    });

    return this;
};

// Util to deep clone simple object
Model.prototype.copy = function(data, objectMap = new WeakMap()) {
    if (!this.isObject(data)) return data;
    
    // Detect circular reference in data.
    if (objectMap.has(data)) {
        throw new Error("Lump Model cannot contain circular references.");
    }
    objectMap.set(data, true);

    // Good to go. get cloneing.
    const tmp = Array.isArray(data) ? [] : {};
    for (let key in data) {
        if (data.hasOwnProperty(key)) {
            tmp[key] = this.copy(data[key], objectMap);
        }
    }

    return tmp;
};

// Detect change type for a primative
Model.prototype.detectChangeType = function(original, updated) {
    if (typeof updated === 'undefined' && typeof original === 'undefined') return 'REMOVE'; // complete detach
    if (typeof original === 'undefined') return 'CREATE'; // additional key added to our new data
    if (typeof updated === 'undefined') return 'REMOVE'; // old key removed from our new data
    if (original==updated) return 'NONE'; // data unchanged between the two keys

    return 'UPDATE'; // A mix - so an update
};

// Detect objects that are not NULL values
Model.prototype.isObject = function(value) {
    return (typeof value === 'object' && value !== null);
};

// Detect changes in watched data
Model.prototype.detectChanges = function(keys, original, updated, namespace = '') {
    // Detect any changes in the affected data path
    // (keys is an array starting from the root of the affected location)
    const next = keys.shift();
    let returnType = 'UPDATE';

    namespace = namespace ? `${namespace}.${next}` : next;

    // Get values we're comparing
    original = original ? original[next] : undefined;
    updated = updated ? updated[next] : undefined;


    // Target key not yet reached, dig on to the next key
    if (keys.length != 0) {
        returnType = this.detectChanges(this.copy(keys), original, updated, namespace);
        // If real change was a create or remove, this parent has been updated, so swap type
        if (returnType == 'CREATE' || returnType == 'REMOVE') returnType = 'UPDATE';
    }

    // Target depth reached.
    if (keys.length == 0) {
        // Detect attribute changes to children
        // ie. if you remove an object, its children need to fire remove events
        if (this.isObject(updated) || this.isObject(original)) {

            // Check for field changes
            const fields = new Set([
                ...(this.isObject(updated)) ? Object.keys(updated) : [],
                ...(this.isObject(original)) ? Object.keys(original) : [],
            ]);

            const results = [];
            for (const key of fields) {
                results.push(this.detectChanges([key], original, updated, namespace));
            }

            // Object checks
            // If both old/new don't exist, these values were detached/removed
            // If only original doesn't, then we're creating
            // If only new doesn't, we're removing
            if (typeof updated === 'undefined' && typeof original === 'undefined') returnType = 'REMOVE';
            if (typeof original === 'undefined') returnType = 'CREATE';
            if (typeof updated === 'undefined') returnType = 'REMOVE';
            if (results.length === 0) returnType = 'NONE'; // Empty

            // If all the sub objects were unchanged, the ob was unchanged.
            if (results.length !== 0 && results.every(function(val) {
                return val == 'NONE';
            })) {
                returnType = 'NONE';
            }
        } else {
            // Else, detect change type on this specific attribute
            returnType = this.detectChangeType(original, updated);
        }
    }

    // Workout wildcard datapath
    const wildcardNamespace = namespace.substr(0, namespace.lastIndexOf('.')+1) + '*';
    // reload updated from store so we return proxy instance of objects
    const updatedData = (typeof updated === 'object') ? this.get(namespace) : updated;

    // Fire change type events
    switch (returnType) {
    case 'CREATE':
        this.trigger('create:'+namespace, updatedData);
        this.trigger('create:'+wildcardNamespace, updatedData);
        break;
    case 'UPDATE':
        this.trigger('update:'+namespace, updatedData, original);
        this.trigger('update:'+wildcardNamespace, updatedData, original);
        break;
    case 'REMOVE':
        this.trigger('remove:'+namespace, original);
        this.trigger('remove:'+wildcardNamespace, original);
        break;
    case 'NONE':
        this.trigger('unchanged:'+namespace, updatedData);
        break;
    }

    // Fire general change events, both namspaced and global.
    if (returnType !== 'NONE') {
        this.trigger('change:'+namespace, returnType, updated, original);
        this.trigger('change:'+wildcardNamespace, returnType, updated, original);
    }

    this.trigger('all', returnType, namespace, updated, original);

    return returnType;
};

// Apply change to original, so new changes can be detected
Model.prototype.commitChanges = function(keys, original, updated) {
    const next = keys.shift();
    // Insert either at most accurate point, or where original does not yet exist
    if (keys.length == 0 || !original[next]) {
        original[next] = this.copy(updated[next]);
        return;
    }
    return this.commitChanges(keys, original[next], updated[next]);
};


/**
 * Proxy access for `get`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedGet(parent, context) {
    return function(key, fallback) {
        return parent.get(getContext(context, key), fallback);
    };
}

/**
 * Proxy access for `set`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedSet(parent, context) {
    return function(key, value) {
        return parent.set(getContext(context, key), value);
    };
}

/**
 * Proxy access for `set`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedEvents(parent, context) {
    return function(key) {
        return parent.getEvents(getContext(context, key));
    };
}

/**
 * Proxy access for `on`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedOn(parent, context) {
    return function(event, callback) {
        parent.on(getEventContext(context, event), callback);
        return this;
    };
}

/**
 * Proxy access for `off`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedOff(parent, context) {
    return function(event, callback) {
        parent.off(getEventContext(context, event), callback);
        return this;
    };
}

/**
 * Proxy access for `subscribe`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedSubscribe(parent, context) {
    return function(subscriber, namespace) {
        parent.subscribe(subscriber, namespace);
        return this;
    };
}

/**
 * Proxy access for `unsubscribe`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedUnsubscribe(parent, context) {
    return function(subscriber, namespace) {
        parent.unsubscribe(subscriber, namespace);
        return this;
    };
}

/**
 * Proxy access for `on`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function delegatedTrigger(parent, context) {
    return function(event, data) {
        parent.trigger(getEventContext(context, event), data);
        return this;
    };
}

/**
 * getEventContext - return event:datapath
 *
 * @param  {[type]} context [description]
 * @param  {[type]} event   [description]
 * @return {[type]}         [description]
 */
function getEventContext(context, event) {
    let ctx = context ? `${event}:${context}` : event;
    // Event may either be purely the event type (change,update)
    // or type + sub key change:subAttr. In case of sub attr
    // we want to insert context between the event and the path
    if (event.includes(':') && context) {
        const parts = event.split(':');
        ctx = `${parts[0]}:${context}.${parts[1]}`;
    }

    return ctx;
}

/**
 * getContext return data path to current target.
 *
 * @param  {[type]} context [description]
 * @param  {[type]} prop    [description]
 * @return {[type]}         [description]
 */
function getContext(context, prop) {
    const key = Array.isArray(prop) ? prop.join('.') : prop;
    return context ? context + '.' + key : key;
}

/**
 * Export model factory
 *
 * @param  {mixed} data [description]
 * @return {Model}      [description]
 */
export default function(data) {
    return (new Model(data)).data;
}
