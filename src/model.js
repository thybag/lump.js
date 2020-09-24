const Model = function(data) {
    let parent = this;
    // Cache data access/edit
    this._cache = new WeakMap();
    this._data = data;
    // Eventing
    this._events = {};
    this._listeners = {};

    // Create watcher proxy
    function newProxy(result, context) {
        const proxyTraps =  {
            get: function(obj, prop, receiver)
            {
                let ctx = context ? context + '.' + prop : prop;
                // Trigger read event
                parent.trigger("read", ctx);

                let result = Reflect.get(obj, prop);
                if (typeof result === 'object') {
                    result = newProxy(result, ctx);
                }
                return result;
            },
            set: function(obj, prop, value) {
                let ctx = context ? context + '.' + prop : prop;

                // Trigger create/update/change events
                if (obj[prop]) {
                    parent.trigger("update:"+ctx, value);
                } else {
                    parent.trigger("create:"+ctx, value);
                }
                parent.trigger("change", ctx, value);

                Reflect.set(obj, prop, value);
                return true;
            }
        };
        // Config proxy or get from cache
        const resultProxy = parent._cache.get(result) || new Proxy(result, proxyTraps);
        parent._cache.set(result, resultProxy);
        return resultProxy;
    }

    // Watch changes via proxy
    this.data = newProxy(this._data, '');
}
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
    for(let listener of Object.values(this._listeners)) {
        listener.trigger(event, ...args);
    }
}
Model.prototype.on = function(key, method) {
        (this._events[key] = this._events[key] || []).push([event, method]);
        return this;
}  
Model.prototype.addListener = function (listener) {
    if (typeof listener.trigger !== 'function'){
        throw 'Unsupported listener type provided. Must implement trigger method.'
    }
    this._listeners[listener] = listener;
}
export default Model;