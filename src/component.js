const Component = function() {
    // Component
    let ComponentImplementation = function(config) {
        // Copy methods to Object
        if (config) {
            Object.keys(config).forEach(function(key) {
                if(key != 'events') this[key] = config[key];
            }, this);
        }

        // Create el if none provided.
        if (!this.el) {
            this.el = document.createElement('div');
        }

        this.initialize.apply(this, arguments);
        this.connect.apply(this, [config.events]);
    }
    ComponentImplementation.prototype._events = {};
    ComponentImplementation.prototype.trigger = function(event, ...args) {
        for (let i of this._events[event] || []) {
            // Trigger event (either func or method to call)
            if (typeof i[1] === "function") {
                i[1](...args);
            }else {
                this[i[1]](...args);
            }
        }
    }
    ComponentImplementation.prototype.on = function(key, method) {
        // Add a listener
        let split = key.indexOf(' ');
        let event = (split===-1) ? key : key.substr(0,split);
        let target = (split===-1) ? '' : key.substr(split+1);

        // Handle custom event
        if (!(['click','keyup','keydown', 'focus', 'blur'].includes(event)) && !(event in this.el)) {
            (this._events[key] = this._events[key] || []).push([event, method]);
            return this;
        }

        // If no target, bind to root el
        if (!target) {
            this.el.addEventListener(event, method);
            (this._events[key] = this._events[key] || []).push([event, method]);
            return this;
        }

        // Else handle as deligated
        let handler = (e) => {
            // e.target was the clicked element
            if (e.target && e.target.matches(target)) {
                // If function? run it
                this[method](e.target);
            }
        }

        this.el.addEventListener(event, handler);
        (this._events[key] = this._events[key] || []).push([event, handler]);
        return this;
    }
    ComponentImplementation.prototype.off = function(key) {
        // Remove a listener
        for (let [event, handler] of this._events[key] || []) {
             this.el.removeEventListener(event, handler);
        }
        delete this._events[key];
    }
    ComponentImplementation.prototype.connect = function(events) {
        if (!events || typeof events !== 'object') return;
        // connected all events
        for (let [key, method] of Object.entries(events)) {
            this.on(key, method);
        }
    }
    ComponentImplementation.prototype.disconnect = function() {
        // Remove all events
        for (let [key, method] of Object.entries(this._events)) {
            this.off(key);
        }
    }
    ComponentImplementation.prototype.listenTo = function(model) {
        if (typeof model.addListener !== 'function'){
            throw 'Model does not support listeners';
        }
        model.addListener(this);
    }
    // Placeholders
    ComponentImplementation.prototype.initialize = function() {}
    ComponentImplementation.prototype.render = function() {}

    // Factory features
    this.config = [];

    // Provider
    this.make = function(config) {
        return new ComponentImplementation({...this.config, ...config});
    }

    // Define base component
    this.define = function(config)
    {
        let definedComponent = new Component;
        definedComponent.config = config;
        return definedComponent;
    }
}

export default new Component;