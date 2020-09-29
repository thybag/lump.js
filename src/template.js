var toString36 = (num) => num.toString(36).substr(2);

var getUid = () => toString36(Math.random()) + toString36(Date.now());

const Template = function(markupFragments, modelProps) {
    this.markupFragments = markupFragments;
    this.modelProps = modelProps;
    this.propNodeMap = {};
    this.uid = getUid();
    this.el = document.createElement('span');
    this.el.setAttribute(`data-el-${this.uid}`, '');
    this.el.innerHTML = markupFragments.join(`<span data-el-${this.uid}-placeholder></span>`);
    const placeholders = this.el.querySelectorAll(`[data-el-${this.uid}-placeholder]`);
    this.modelProps.forEach((prop, ind) => {
        const placeholder = placeholders[ind];
        const textNode = document.createTextNode('');
        placeholder.parentNode.insertBefore(textNode, placeholder);
        placeholder.parentNode.removeChild(placeholder);
        (this.propNodeMap[prop] = this.propNodeMap[prop] || []).push(textNode);
    });
};

Template.prototype.bind = function(model) {
    model.on('change', (type, namespace, updated) => {
        if (namespace in this.propNodeMap) {
            for (let node of this.propNodeMap[namespace]) {
                node.data = updated;
            }
        }
    });
    for (let [prop, nodes] of Object.entries(this.propNodeMap)) {
        for (let node of nodes) {
            node.data = model.get(prop);
        }
    }
    return this;
}

// TODO: appendTo, insertBefore, insertAfter
// TODO: Something to handle arrays (and objects)

const createTemplate = (markupFragments, ...modelProps) => new Template(markupFragments, modelProps);

/**
 * Use like:
 *
 * const model = new Model({ name: { first: 'Foo', last: 'Bar' }, item: 'bar' });
 *
 * const NameBadge = createTemplate`<div class="namebadge">
 * Hello, my name is ${'name.first'} ${'name.last'}
 * </div>
 * <span>${'name.first'} has a ${'item'}</span>`.bind(model);
 *
 * document.body.appendChild(NameBadge.el);
 *
 * Will render:
 * Hello, my name is Foo Bar
 * Foo has a bar
 *
 * When:
 * model.data.name.first = 'Baz';
 *
 * Output will change automatically:
 * Hello, my name is Baz Bar;
 * Baz has a bar
 */

export {
    Template,
    createTemplate,
};