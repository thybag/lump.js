/**
 * Basic model to watch data. Will fire events on changed parts of data tree.
 *
 */
const Model = function(_data) {
    let parent = this;
    // Cache data access/edit
    let _cache = new WeakMap();
    let _original = JSON.parse(JSON.stringify(_data));

    // Eventing
    this._events = {};
    this._listeners = [];

    // Dete
    this.applyChanges = function(ctx)
    {
        // Detect changes to data
        let change = this.detectChanges(ctx.split('.'), _original, _data);
        // Update internal data to match
        if (change !== 'NONE') this.commitChanges(ctx.split('.'), _original, _data);
    }

    // Create watcher proxy
    function newProxy(result, context) {
        const proxyTraps =  {
            get: function(obj, prop, receiver)
            {
                let ctx = context ? context + '.' + prop : prop;
                let result = Reflect.get(obj, prop);
                if (typeof result === 'object') {
                    result = newProxy(result, ctx);
                }

                // Trigger read event
                parent.trigger("read", ctx);
                return result;
            },
            set: function(obj, prop, value) {
                let success = Reflect.set(obj, prop, value);
                let ctx = context ? context + '.' + prop : prop;
                // Detect changes and fire relevent events
                parent.applyChanges(ctx);

                return success;
            }
        };
        // Config proxy or get from cache
        const resultProxy = _cache.get(result) || new Proxy(result, proxyTraps);
        _cache.set(result, resultProxy);
        return resultProxy;
    }
    // Watch changes via proxy
    this.data = newProxy(_data, '');
}

const jsPathRegex = /([^[.\]])+/g;

// get attribute
Model.prototype.get = function(key, fallback = undefined)
{
    if (!key) return fallback;

    const keyArray = Array.isArray(key) ? key : key.match(jsPathRegex);

    return (
        keyArray.reduce((prevObj, key) => prevObj && prevObj[key], this.data) || fallback
    );
}
// Set attribute
Model.prototype.set = function(key, value)
{
    const keyArray = Array.isArray(key) ? key : key.match(jsPathRegex);

    keyArray.reduce((acc, prop, i) => {
        if (acc[prop] === undefined) acc[prop] = {}
        if (i === keyArray.length - 1) acc[prop] = value;
        return acc[prop];
    }, this.data);
}
// Trigger event
Model.prototype.trigger = function(event, ...args) {
    // Fire own event
    for (let i of this._events[event] || []) {
        // Trigger event (either func or method to call)
        if (typeof i[1] === "function") {
            i[1](...args);
        }else {
            this[i[1]](...args);
        }
    }

    // Fire listeners
    for(let listener of this._listeners) {
        listener.trigger(event, ...args);
    }
}
// Add event
Model.prototype.on = function(key, method) {
    (this._events[key] = this._events[key] || []).push([key, method]);
    return this;
}
// Remove event
Model.prototype.off = function(key, method) {
    if (!this._events[key]) return this;

    // Delete all listners if no method
    if (!method) {
        delete this._events[key];
        return this;
    }
    // Else only one with method
    for (let evt in this._events[key]) {
        if(this._events[key][evt][1] == method) {
            this._events[key].splice(evt, 1);
        }
    }

    return this;
}
// Add listener
Model.prototype.addListener = function (listener) {
    if (typeof listener.trigger !== 'function'){
        throw 'Unsupported listener type provided. Must implement trigger method.'
    }
    this._listeners.push(listener);
    return this;
}
// Remove listener
Model.prototype.removeListener = function (listener) {
    let idx = this._listeners.indexOf(listener);
    if (idx !== -1) {
        this._listeners.splice(this._listeners.indexOf(listener), 1);
    }
    return this;
}

// Util to clone object
Model.prototype.copy = function(data)
{
    return (typeof data == 'object') ? JSON.parse(JSON.stringify(data)) : data;
}
// Detect change type for a primative
Model.prototype.detectChangeType = function(original, updated)
{
    if(!original) return "CREATE"; // additional key added to our new data
    if(!updated) return "REMOVE"; // old key removed from our new data
    if(original==updated) return "NONE"; // data unchanged between the two keys

    return "UPDATE"; // A mix - so an update
}
// Detect changes in watched data
Model.prototype.detectChanges = function (keys, original, updated, namespace = '')
{
    // Detect any changes in the affected data path
    // (keys is an array start from root the the affected location)
    let next = keys.shift();
    let returnType = 'UPDATE';
    let _changes = [];
    namespace = namespace ? `${namespace}.${next}` : next;

    // Get values we're comparing
    original = original ? original[next] : undefined;
    updated = updated ? updated[next] : undefined;

    // Target key not yet reached, dig on to the next key
    if (keys.length != 0) returnType = this.detectChanges(this.copy(keys), original, updated, namespace);

    // Target depth reached.
    if (keys.length == 0) {
        // Detect attribute changes to children
        if (typeof updated == 'object' || typeof original == 'object') {
            // Check for field changes
            let fields = new Set([
                ...(updated) ? Object.keys(updated) : [],
                ...(original) ? Object.keys(original) : []
            ]);

            let results = [];
            for (let key of fields) {
                results.push(this.detectChanges([key], original, updated, namespace));
            }
            // Object checks
            if(!original) returnType = 'CREATE';
            if(!updated) returnType = 'REMOVE';
            if (results.every(function(val){ return val == 'NONE'})) {
                returnType = 'NONE';
            }
        } else {
            // Else, detect change type on this specific attribute
            returnType = this.detectChangeType(original, updated);
        }
    }

    // Fire change type events
    switch (returnType) {
        case 'CREATE':
            this.trigger("create:"+namespace, updated);
            break;
        case 'UPDATE':
            this.trigger("update:"+namespace, updated, original);
            break;
        case 'REMOVE':
            this.trigger("remove:"+namespace, original);
            break;
        case 'NONE':
            this.trigger("unchanged:"+namespace);
            break;
    }

    // Fire general change events
    this.trigger("change:"+namespace, returnType, updated, original);
    this.trigger("change", returnType, namespace, updated, original);

    return returnType;
}
// Apply change to original, so new changes can be detected
Model.prototype.commitChanges = function(keys, original, updated){
    let next = keys.shift();
    // Insert either at most accurate point, or where original deoes not yet exist
    if (keys.length == 0  || !original[next]) {
        original[next] = this.copy(updated[next]);
        return;
    }
    return this.commitChanges(keys, original[next], updated[next]);
}

export default Model;
