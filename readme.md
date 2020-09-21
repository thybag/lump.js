# Lump.js

A simple "backbone.js"-like "Component" library. This library is entirely unnecessary and not meant for production use. I created this purely as a way to play around with some of the ideas involved in the "backbone" views, plus some of the newer ES6 features such as proxies. This library is entirely stand alone and has no dependencies. Only modern browsers are supported.

Currently the library consists of two parts.

## Component
A simple wrapper around some rendered markup, using delegated events.

Key features;
* Delegated events setup in {events}. These can be both DOM events, or custom ones you trigger manually.
* Functions can be async, if you want to load data
* on/off/trigger to fire events.

```
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

```

## Model
Basic model component that will keep track of the contents of it's data using proxies. Events are fired on any change that can be listened to in a view.

```
    let model = new Model({'test': {'hello': 'world'},'info': 'test box'});
    model.on('change', function(prop, value){
        console.log("changed", prop, value);
    });
    model.on('read', function(prop){
        console.log("read", prop);
    });

 ```
Change to `model.data.info = 'abc'` will trigger `changed info abc `
Change to `model.data.test.hello = 'me'` will trigger `changed test.hello me `
