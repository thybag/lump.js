// Use whitelist to determine if events exist.
// In many cases only the "target" will have these & we will be catching the bubbled version.
const nativeEvents = [
    'click',
    'dblclick',
    'keyup',
    'keydown',
    'dragenter',
    'dragover',
    'dragleave',
    'drop',
    'copy',
    'cut',
    'focus',
    'paste',
    'contextmenu',
    'focusin', // focus
    'focusout', // blur?
    'change',
];
// Blur/focus cannot be defered, so use
// override events instead on listeners
const eventOverride = {
    'focus': 'focusin',
    'blur': 'focusout',
};

const Component = function() {
    // Component
    const ComponentImplementation = function(config) {
    // Copy methods to Object
        if (config) {
            Object.keys(config).forEach(function(key) {
                if (key != 'events') this[key] = config[key];
            }, this);
        }

        // Create el if none provided.
        if (!this.el) {
            this.el = document.createElement('div');
        }

        /* eslint-disable prefer-rest-params */
        this.initialize(...arguments);
        this.connect(config.events);
    };

    ComponentImplementation.prototype.trigger = function(event, ...args) {
        for (const i of this._events[event] || []) {
            // Trigger event (either func or method to call)
            i[1](...args);
        }
    };
    ComponentImplementation.prototype.on = function(key, method) {
    // Add a listener
        const split = key.indexOf(' ');
        let event = (split===-1) ? key : key.substr(0, split);
        const target = (split===-1) ? '' : key.substr(split+1);

        // Override event type if needed.
        if (eventOverride[event]) {
            event = eventOverride[event];
        }

        // Wrap runner in to method
        const run = (...args) => {
            if (typeof method === 'function') {
                method(...args);
            } else {
                this[method](...args);
            }
        };

        // Handle custom event
        if (!(nativeEvents.includes(event)) && !(event in this.el)) {
            (this._events[key] = this._events[key] || []).push([event, run]);
            return this;
        }

        // If no target, bind to root el
        if (!target) {
            this.el.addEventListener(event, run);
            (this._events[key] = this._events[key] || []).push([event, run]);
            return this;
        }

        // Else handle as deligated
        const handler = (e) => {
            // e.target was the clicked element
            if (e.target && e.target.matches(target)) {
                // If function? run it
                run(e, e.target);
            }
        };

        this.el.addEventListener(event, handler);
        (this._events[key] = this._events[key] || []).push([event, handler]);
        return this;
    };
    ComponentImplementation.prototype.off = function(key) {
    // Remove a listener
        for (const [event, handler] of this._events[key] || []) {
            this.el.removeEventListener(event, handler);
        }
        delete this._events[key];
    };
    ComponentImplementation.prototype.connect = function(events) {
    // Create events on new obj, so components don't share
        this._events = [];
        if (!events || typeof events !== 'object') return;
        // connected all events
        for (const [key, method] of Object.entries(events)) {
            this.on(key, method);
        }
    };
    ComponentImplementation.prototype.disconnect = function() {
    // Remove all events
        for (const [key] of Object.entries(this._events)) {
            this.off(key);
        }
    };
    ComponentImplementation.prototype.listenTo = function(model) {
        if (typeof model.addListener !== 'function') {
            throw new Error('Model does not support listeners');
        }
        model.addListener(this);
    };
    // Placeholders
    ComponentImplementation.prototype.initialize = function() {};
    ComponentImplementation.prototype.render = function() {};

    // Factory features
    this.config = [];

    // Provider
    this.make = function(config) {
        return new ComponentImplementation({...this.config, ...config});
    };

    // Define base component
    this.define = function(config) {
        const definedComponent = new Component;
        definedComponent.config = config;
        return definedComponent;
    };
};

export default new Component;
