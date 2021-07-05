/**
 * [safeText description]
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
function safeText(data) {
    // Recusivly make sub objects safe
    if (typeof data === 'object') {
        Object.entries(data).forEach(([key, value]) => {
            data[key] = safeText(value);
        });
        return data;
    }

    // Render as text node
    const html = document.createElement('p');
    html.appendChild(document.createTextNode(data));
    return html.innerHTML;
}

/**
 * Create a reusable template
 * Currently all params passed to render are assumed to be primatives
 *
 * @param {[type]} methods [description]
 */
function Template(methods) {
    this.render = function(...args) {
        // Escape input values
        if (methods.safe !== false) {
            // Ensure args are safe
            args = args.map( (value) => {
                return safeText(value);
            });
        }

        // Render template itself
        const container = document.createElement('div');
        const tpl = (typeof methods.template === 'function') ? methods.template(...args) : methods.template;
        container.innerHTML = tpl;

        if (methods.className) {
            container.className = methods.className;
        }

        // Return element
        return container;
    };
}

/**
 * Make a new Template
 *
 * @param  {...[type]} args [description]
 * @return {[type]}         [description]
 */
export default function(...args) {
    return new Template(...args);
}
