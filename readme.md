# Lump.js

A simple component and reactive model library built for modern JS. 
This library is being created out of personal interest and is not meant for production use. 

This library is entirely stand alone and has no dependencies. Only modern browsers are supported.

Lump is currency composed of two key elements.

 - *Components* - Defines logic for managing a selected area of the DOM. Heavily inspired by some of my favorite backbone.js features/approaches in terms of deferred event listeners and none perspective approach. 
 - *Models* - A wrapper for arbitrary data, implementing a reactive layer using proxies. Interaction with the model is done primarly by registering event listens, that will trigger whenever a change is detected on its data path. The key change types are `create` `update`,`remove`. Changes from subobjects will automatically bubble to their parents.


## Usage

Install using NPM direct from Github.

```
 npm install git://git@github.com:thybag/lump.js.git
```

Then import either Component or Model where you want them.

```
import Component from 'lumpjs/src/component.js';
import Model from 'lumpjs/src/model.js';
```

## Component
A simple wrapper around some rendered markup, using delegated events.

Key features;
* Delegated events setup in {events}. These can be both DOM events, or custom ones you trigger manually.
* Functions can be async, if you want to load data
* on/off/trigger to fire events.

`Component` implements two key methods
* Make - Create a new component using a given config
* Define - setup a reusable component. This can be invoked by calling make on them with the data/overrides you would like to use.

```js
let InfoBox = Component.make({
    el: document.getElementById('infobox'),
    initialize: function () {
        // Setup
        this.render();
    },
    events: {
        "click button.load": "loadData",
    },
    render: function () {
        let fragment = document.createDocumentFragment();
        // Render logic

        // Set HTML
        this.el.innerHTML = '';
        this.el.appendChild(fragment);
    },
    loadData: async function(contentId) {
        let data = await fetch("test/endpoint");
        let json = await data.json();

        console.log("data ready. Store it and render")
        this.render();
    }
});

let GenericInfoBox = Component.define({
    initialize: function () {
        // Setup
        this.render();
    },
    events: {
        "click button.load": "loadData",
    },
    render: function () {
        let fragment = document.createDocumentFragment();
        // Render logic

        // Set HTML
        this.el.innerHTML = '';
        this.el.appendChild(fragment);
    },
});

let SpecificInfoBox = GenericInfoBox.make({
    el: document.getElementById('infobox'),
    loadData: async function(contentId) {
        let data = await fetch("test/endpoint");
        let json = await data.json();
        this.render();
    }
})

```

## Model
Basic model component that will keep track of the contents of it's data using proxies. Events are fired for any changes and can be listened to via the on method.

Model events use a deferred listener approach, where by the manager will fire events for any object within your provided namespace, allowing for easy detection of complete object replacement. 

*Key data events.*

* `on('create:{datapath}', (newValue) => {})` - New data created at datapath
* `on('update:{datapath}', (newValue, previousValue) => {})` - Data at datapath has been changed to a new value
* `on('remove:{datapath}', (previousValue) => {})` - Data at datapath no longer exists
* `on('unchanged:{datapath}', (previousValue) => {})` - datapath was updated to an identical value
* `on('change:{datapath}', (changeType, newValue, oldValue) => {})` - Change of any type to datapath
* `on('change', (changeType, datapath, newValue, oldValue) => {})`- Change to any data

*Datapath* is a dot notation representation of the path to the data you want to watch.
e.g. `title`, `company.name`, `company.employees.0.name` or `company.employees[0].name`

Each object in the Model supports the magic methods `on`, `get` and `set`. Adding a `on('update')` to one of these will register a model listener for the objects current datapath.

```js
let model = new Model({'test': {'hello': 'world'},'info': 'test box'});

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
let test = model.data.test;
test.on('update', () => {console.log("I've been changed");} )

// Change via getter/setter or directly
model.set('test.goodbye', 'value');
model.data.test.hello = 'new value';

// of full object replacement 
model.set('test', {'newObject': 'hi'});
 ```
Change to `model.data.info = 'abc'` will trigger `changed info abc `
Change to `model.data.test.hello = 'me'` will trigger `changed test.hello me`

### Planned features

 * Upgrading `Component` to include an inbuilt models on `data`, for easier re-rendering/change detection.
 * Templates helper library to abstract basic markup templates away.

