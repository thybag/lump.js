const jsPathRegex = /([^[.\]])+/g;

/**
 * Basic model to watch data. Will fire events on changed parts of data tree.
 *
 * @param {object} _data - Initial data for model to hold.
 */
const Model = function(_data) {
    const parent = this;

    // Cache data access/edit
    const _cache = new WeakMap();
    const _original = JSON.parse(JSON.stringify(_data));

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
            keyArray.reduce((prevObj, key) => prevObj && prevObj[key], _real) || fallback
        );

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
    function newAccessProxy(context) {
        const proxyTraps = {
            get(obj, prop, receiver) {
                // Handle magic methods for object
                if (prop === 'get') return magicGet(parent, context);
                if (prop === 'set') return magicSet(parent, context);
                if (prop === 'on') return magicOn(parent, context);
                if (prop === 'getContext') return () => context;
                // Support json stringify by pass access to the real object
                if (prop === 'toJSON') return () => _get(context);

                // else just get as normal
                return parent.get(getContext(context, prop));
            },
            set(obj, prop, value) {
                // Set data to the context path
                return parent.set(getContext(context, prop), value);
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
    this.get = (key, fallback) => {
        const result = _get(key, fallback);
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
        const namespace = ns ? ns+':' : '';
        subscriber.trigger(namespace+event, ...args);
    }
};

/**
 * Listen for event on model
 * @param  {string} key    Object path using dot or array notation.
 * @param  {[type]} method [description]
 * @return {[type]}        [description]
 */
Model.prototype.on = function(key, method) {
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

    // Delete all listners if no method
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

// Util to clone object
Model.prototype.copy = function(data) {
    return (typeof data == 'object') ? JSON.parse(JSON.stringify(data)) : data;
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

    this.trigger('change', returnType, namespace, updated, original);

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
function magicGet(parent, context) {
    return function(key) {
        return parent.get(`${context}.${key}`);
    };
}

/**
 * Proxy access for `set`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function magicSet(parent, context) {
    return function(key, value) {
        return parent.set(`${context}.${key}`, value);
    };
}

/**
 * Proxy access for `on`
 * @param  {[type]} parent  [description]
 * @param  {[type]} context [description]
 * @return {[type]}         [description]
 */
function magicOn(parent, context) {
    return function(event, callback) {
        let listener = `${event}:${context}`;
        // Event may either be purely the event type (change,update)
        // or type + sub key change:subAttr. In case of sub attr
        // we want to insert context between the event and the path
        if (event.includes(':')) {
            const parts = event.split(':');
            listener = `${parts[0]}:${context}.${parts[1]}`;
        }
        return parent.on(listener, callback);
    };
}

/**
 * getContext return datapath to current target.
 *
 * @param  {[type]} context [description]
 * @param  {[type]} prop    [description]
 * @return {[type]}         [description]
 */
function getContext(context, prop) {
    return context ? context + '.' + prop : prop;
}

export default Model;
