import makeTemplate from './template.js';
import Model from './model.js';

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

        // Init templates
        if (this.template) {
            this._template = makeTemplate({template: this.template, className: this.className});
        }

        // Init data
        if (this.data) {
            // Connect model
            this._model = new Model(this.data);
            this.data = this._model.data;
        }

        /* eslint-disable prefer-rest-params */
        this.initialize(...arguments);
        this.connect(config.events);
    };

    /**
     * setEl Set contents of base el based on Element.
     *
     * @param {[type]} el [description]
     */
    ComponentImplementation.prototype.setEl = function(el) {
        this.el.innerHTML = el.innerHTML;
    };

    /**
     * Trigger - Trigger an event
     *
     * @param  {[type]}    event [description]
     * @param  {...[type]} args  [description]
     */
    ComponentImplementation.prototype.trigger = function(event, ...args) {
        for (const i of this._events[event] || []) {
            // Trigger event (either func or method to call)
            i[1](...args);
        }
    };

    /**
     * Add listener
     * @param  {[type]} key    [description]
     * @param  {[type]} method [description]
     * @return {[type]}        [description]
     */
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
                method.apply(this, args);
            } else {
                this[method](...args);
            }
        };

        // Handle custom event
        if (!(nativeEvents.includes(event)) && !(event in this.el)) {
            (this._events[key] = this._events[key] || []).push([event, run]);
            return this;
        }

        // Else handle as deligated
        const handler = (e) => {
            if (!target) return run(e, e.target);

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

    /**
     * Remove event listener
     *
     * @param  {[type]} key [description]
     * @return {[type]}     [description]
     */
    ComponentImplementation.prototype.off = function(key) {
        // Remove a listener
        for (const [event, handler] of this._events[key] || []) {
            this.el.removeEventListener(event, handler);
        }
        delete this._events[key];

        return this;
    };

    /**
     * Configure events for el
     *
     * @param  {[type]} events [description]
     */
    ComponentImplementation.prototype.connect = function(events) {
        // Create events on new obj, so components don't share
        this._events = [];

        // Add listener to own model
        if (this._model) {
            this._model.addListener(this, 'data');
            this.on('data:updated', 'render');
        }

        if (!events || typeof events !== 'object') return;

        // connected all events
        for (const [key, method] of Object.entries(events)) {
            this.on(key, method);
        }
    };

    /**
     * Disconnect all events from el
     */
    ComponentImplementation.prototype.disconnect = function() {
        // Remove all events
        for (const [key] of Object.entries(this._events)) {
            this.off(key);
        }

        // Remove listener from own model
        if (this._model) this._model.removeListener(this, 'data');
    };

    /**
     * Remove this el
     */
    ComponentImplementation.prototype.destroy = function() {
        this.disconnect();
        if (this.el) this.el.remove();
    };

    /**
     * Listen to a model / other component
     *
     * @param  {[type]} model     [description]
     * @param  {String} namespace [description]
     */
    ComponentImplementation.prototype.listenTo = function(model, namespace = '') {
        if (typeof model.addListener !== 'function') {
            throw new Error('Model does not support listeners');
        }
        model.addListener(this, namespace);
    };

    /**
     * Called on boot.
     * Triggers render by default
     */
    ComponentImplementation.prototype.initialize = function() {
        this.render();
    };

    /**
     * render method defines display logic. Normally calls tpl
     */
    ComponentImplementation.prototype.render = function() {};

    /**
     * Render template defined in template var
     *
     * @param  {...[type]} args [description]
     * @return {[type]}         [description]
     */
    ComponentImplementation.prototype.tpl = function(...args) {
        if (!this._template) {
            throw new Error('This component does not implement a template');
        }
        return this._template.render(...args);
    };

    // Extra methods
    ComponentImplementation.prototype.addEventListener = ComponentImplementation.prototype.on;
    ComponentImplementation.prototype.removeEventListener = ComponentImplementation.prototype.off;

    // Factory features
    this.config = [];

    // Provider
    this.make = function(config) {
        return new ComponentImplementation({...this.config, ...config});
    };

    // Define base component
    this.define = function(config) {
        const definedComponent = new Component;
        definedComponent.config = {...this.config, ...config};
        return definedComponent;
    };

    // Compose component from multiple
    this.compose = function(...args) {
        let config = {};

        args.forEach((c)=> {
            if (c instanceof Component) {
                config = {...config, ...c.config};
            } else if (typeof c === 'object') {
                config = {...config, ...c};
            }
        });

        const definedComponent = new Component;
        definedComponent.config = {...this.config, ...config};
        return definedComponent;
    };
};

export default new Component;
