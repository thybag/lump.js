# Lump.js

A simple component and reactive model library built for modern JS. 
This library is being created out of personal interest and is not meant for production use. 

This library is entirely stand alone and has no dependencies. Only modern browsers are supported.

Lump is currency composed of two key elements.

 - **Components** - Defines logic for managing a selected area of the DOM. Heavily inspired by some of my favorite backbone.js features/approaches in terms of deferred event listeners and none perspective approach. 
 - **Models** - A wrapper for arbitrary data, implementing a reactive layer using proxies. Interaction with the model is done primarily by registering event listens, that will trigger whenever a change is detected on its data path. The key change types are `create` `update`,`remove`. Changes from subobjects will automatically bubble to their parents.


## Usage

Install using NPM or Yarn

```
npm i lumpjs
```
```
yarn add lumpjs
```

Then import either Component or Model where you want them.

```
import Component from 'lumpjs/src/component.js';
import Model from 'lumpjs/src/model.js';
```

## Component
A simple wrapper around some rendered markup, using delegated events.

**Key features**
* Delegated events setup in {events}. These can be both DOM events, or custom ones you trigger manually.
* Functions can be async, if you want to load data
* on/off/trigger to fire events.

`Component` implements two key methods
* **Make** - Create a new component using a given config
* **Define** - setup a reusable component. This can be invoked by calling make on them with the data/overrides you would like to use.

```js     
Component.make({
    el: document.body,
    template: (count) => `Count ${count} <button>Click</button>`,
    data: {
        count: 0
    }, 
    events: {
        'click button': 'increment'
    },
    increment() { 
        this.data.count++; 
    },
    render() {
        this.setEl(this.tpl(this.data.count));
    }
});
```

## Model
Create reactive models for arbitrary data. Changes are managed via delegated data paths ensuring information can never become orphaned or out of sync.

Data is managed by an underlying tracker proxy, and exposed via an accessor proxy to allow you to interact with the model as if its a normal JavaScript.

You can detect changes by registering listeners against given data paths. Changes to sub-objects will bubble back up the parent.

**Key data events.**

* `on('create:{datapath}', (newValue) => {})` - New data created at datapath
* `on('update:{datapath}', (newValue, previousValue) => {})` - Data at datapath has been changed to a new value
* `on('remove:{datapath}', (previousValue) => {})` - Data at datapath no longer exists
* `on('unchanged:{datapath}', (previousValue) => {})` - datapath was updated to an identical value
* `on('change:{datapath}', (changeType, newValue, oldValue) => {})` - Change of any type to datapath
* `on('all', (changeType, datapath, newValue, oldValue) => {})`- Change to any data

**Datapath** is a dot notation representation of the path to the data you want to watch.
e.g. `title`, `company.name`, `company.employees.0.name` or `company.employees[0].name`

Each object in the Model supports the magic methods `on`, `get` and `set`. Adding a `on('update')` to one of these will register a model listener for the objects current datapath.

```js
let model = Model({'test': {'hello': 'world'},'info': 'test box'});

// Add listeners
model.on('create:test.goodbye', function(prop, value){
    console.log("Created goodbye value");
});
model.on('remove:test.hello', function(prop, value){
    console.log("Goodbye hello");
});
model.on('change', function(prop, value){
    console.log("changed", prop, value);
});
model.on('read', function(prop){
    console.log("read", prop);
});

// Add listeners directly to sub objects
let test = model.test;

test.on('update', () => {console.log("I've been changed");} )

// Change via getter/setter or directly
model.test.goodbye = 'value');
model.test.hello = 'new value';

// of full object replacement 
model.test = {'newObject': 'hi', 'hello': 'you'};

console.log(test.hello); // will return you
 ```
Change to `model.info = 'abc'` will trigger `changed info abc`
Change to `model.test.hello = 'me'` will trigger `changed test.hello me`

### Planned features

 * Templates helper library to abstract basic markup templates away.

