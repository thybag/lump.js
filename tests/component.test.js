/**
* @jest-environment jsdom
*/
/* global expect, test, describe */
import Component from '../src/component.js';

describe('Test Events', () => {
    test('Add custom event', () => {
        let called = 0;
        const simple = Component.make({});
        simple.on('batman', (value) => {
            expect(value).toBe('test');
            called++;
        });
        simple.trigger('batman', 'test');

        expect(called).toBe(1);
    });


    test('Add long form custom event', () => {
        let called = 0;
        const simple = Component.make({});
        simple.addEventListener('batman', (value) => {
            expect(value).toBe('test');
            called++;
        });
        simple.trigger('batman', 'test');

        expect(called).toBe(1);
    });

    test('Add native event using on', () => {
        let called = 0;
        const simple = Component.make({});
        simple.on('click', (e, target) => {
            called++;
            expect(target).toBe(simple.el);
        });
        simple.el.click();

        expect(called).toBe(1);
    });
    test('Add native event as method name', () => {
        let called = 0;

        const simple = Component.make({
            events: {
                'click': 'method',
            },
            method: function(e, target) {
                called++;
                expect(target).toBe(simple.el);
            },
        });

        simple.el.click();
        expect(called).toBe(1);
    });

    test('Add native event as callback', () => {
        let called = 0;

        const simple = Component.make({
            events: {
                'click': function(e, target) {
                    called++;
                    expect(target).toBe(simple.el);
                },
            },
        });

        simple.el.click();
        expect(called).toBe(1);
    });
    test('Add deferred native event', () => {
        let called = 0;

        const div = document.createElement('div');
        div.innerHTML = '<button></button>';
        const button = div.querySelector('button');

        Component.make({
            el: div,
            events: {
                'click button': function(e, target) {
                    called++;
                    expect(target).toBe(button);
                },
            },
        });

        button.click();
        div.click();

        // Only button click clicked
        expect(called).toBe(1);
    });

    test('Trigger undefined event', () => {
        const simple = Component.make({});
        simple.trigger('batman');
    });
});

describe('Test render triggers', () => {
    test('Called by default in init', () => {
        let calls = 0;

        Component.make({
            render: function() {
                calls++;
            },
        });

        expect(calls).toBe(1);
    });

    test('Render triggered whenver data change', () => {
        let calls = 0;

        const test = Component.make({
            data: {count: 0},
            render: function() {
                calls++;
            },
        });

        test.data.count++;
        expect(calls).toBe(2);
    });

    test('Custom initialize bypass default render', () => {
        let calls = 0;

        Component.make({
            initialize: function() {},
            render: function() {
                calls++;
            },
        });

        expect(calls).toBe(0);
    });
});

describe('Test templates', () => {
    test('Static template', () => {
        const simple = Component.make({
            template: `<span>static</span>`,
        });

        expect(simple.tpl('Hello World').innerHTML).toBe('<span>static</span>');
    });
    test('Template function', () => {
        const simple = Component.make({
            template: (word) => `<span>${word}</span>`,
        });

        expect(simple.tpl('Hello World').innerHTML).toBe('<span>Hello World</span>');
    });
    test('Template function XSS', () => {
        const simple = Component.make({
            template: (word) => `<span>${word}</span>`,
        });

        expect(simple.tpl('<h1>hi</h1>').innerHTML).toBe('<span>&lt;h1&gt;hi&lt;/h1&gt;</span>');
    });

    test('Template function with object', () => {
        const simple = Component.make({
            template: (obj) => `<span>${obj.word} ${obj.word2}</span>`,
        });

        expect(simple.tpl({word: 'Hello', word2: 'World'}).innerHTML).toBe('<span>Hello World</span>');
    });
});

describe('Test creation', () => {
    test('Make from Definition', () => {
        const TestComponent = Component.define({
            'name': 123,
        });
        const testing = TestComponent.make();

        expect(testing.name).toBe(123);
    });

    test('Make from Composition', () => {
        const TestComponent1 = Component.define({
            test: function() {
                return this.feature1 + this.feature2 + this.feature3;
            },
        });
        const TestComponent2 = Component.define({
            'feature1': 'abc',
        });
        const TestComponent3 = Component.define({
            'feature2': 'def',
        });

        const CompositComponent = Component.compose(
            TestComponent1,
            TestComponent2,
            TestComponent3,
            {'feature3': 'ghi'},
        );
        const testing = CompositComponent.make();

        expect(testing.test()).toBe('abcdefghi');
    });
});
