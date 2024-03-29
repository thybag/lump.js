/* global expect, test, describe, beforeEach */
import newModel from '../src/model.js';

/**
 * Setup test model
 * @return {[type]} [description]
 */
function makeTestnewModel() {
    return newModel(
        {
            'stuff': {
                'northwind': 'costa',
                'info': [1, 2, 3],
                'nest': [{'foo': 'bar'}],
            },
            'name': 'dave',
            'zero': [],
        },
    );
}

describe('Test basic get functionalty', () => {
    const testModel = makeTestnewModel();

    test('data object exists', () => {
        expect(typeof testModel).toBe('object');
    });
    test('data object is populated', () => {
        expect(testModel.name).toBe('dave');
    });
    test('data object array is populated', () => {
        expect(testModel.stuff.info[1]).toBe(2);
    });
    test('Get root data', () => {
        expect(testModel.get().name).toBe('dave');
        expect(testModel.get('').name).toBe('dave');
    });
    test('non-nested getting', () => {
        expect(testModel.get('name')).toBe('dave');
    });
    test('dot syntax getting', () => {
        expect( testModel.get('stuff.info.1')).toBe(2);
    });
    test('square bracket getting', () => {
        expect(testModel.get('stuff.info[1]')).toBe(2);
    });
    test('array based getting', () => {
        expect(testModel.get(['stuff', 'info', 1])).toBe(2);
    });
    test('mixed syntax getting', () => {
        expect( testModel.get('stuff.nest[0].foo')).toBe('bar');
    });
    test('non-existent fallback response', () => {
        expect(testModel.get('stuff.info.6')).toBe(undefined);
    });
    test('custom fallback response', () => {
        expect(testModel.get('stuff.info.6', 'hello')).toBe('hello');
    });
    test('Get allows access to values with protected names', () => {
        testModel.get = 'test';
        expect(testModel.get('get')).toBe('test');
    });
    test('Get something that doesnt exist', () => {
        expect(testModel.get('bacon.egg.sausage')).toBe(undefined);
    });
});

describe('Test basic set functionalty', () => {
    const testModel = makeTestnewModel();

    test('Basic set', () => {
        testModel.set('name', 'bert');
        expect(testModel.get('name')).toBe('bert');
        expect(testModel.name).toBe('bert');
    });

    test('Nested set', () => {
        testModel.set('stuff.northwind', 'example');
        expect(testModel.stuff.northwind).toBe('example');
        expect(testModel.get('stuff.northwind')).toBe('example');
    });

    test('deep object creation', () => {
        testModel.set('new.object.name.potato', 'Hullo');
        expect(testModel.get('new.object.name.potato')).toBe('Hullo');
    });

    test('Set arrays', () => {
        testModel.set('new.object.arr', [1]);
        expect(testModel.new.object.arr[0]).toBe(1);
        expect(testModel.get('new.object.arr[0]')).toBe(1);
    });

    test('Set numerical property', () => {
        testModel.set('new.object.arr2.0', 'hi');
        expect(testModel.new.object.arr2[0]).toBe('hi');
        expect(testModel.get('new.object.arr2.0')).toBe('hi');
    });

    test('Set numerical property with array syntax', () => {
        testModel.set('new.object.arr3[0]', 'hey');
        expect(testModel.new.object.arr3[0]).toBe('hey');
        expect(testModel.get('new.object.arr3.0')).toBe('hey');
    });

    test('Set as array of attrs', () => {
        testModel.set(['new', 'object', 'arr2', '0'], 'yo');

        expect(testModel.new.object.arr2[0]).toBe('yo');
        expect(testModel.get(['new', 'object', 'arr2', '0'])).toBe('yo');
    });
});

describe('Test read events', () => {
    let testModel;

    beforeEach(() => {
        testModel = makeTestnewModel();
    });

    test('Read via get', () => {
        testModel.on('read', (data) => {
            expect(data).toBe('name');
        });
        testModel.get('name');
    });
    test('Read via object', () => {
        testModel.on('read', (data) => {
            expect(data).toBe('name');
        });
        testModel.name;
    });

    // Deep data read will travel up the chain of values till the relevent one.
    // This means a read listener on stuff will trigger as well as the one on stuff.info
    test('Read deep data', () => {
        const calls = ['stuff', 'stuff.info'];
        testModel.on('read', (data) => {
            expect(data).toBe(calls.pop());
        });
        testModel.get('stuff.info');
    });

    test('Add additional listeners', () => {
        const f1 = function(a) {
            return 1+1;
        };
        const f2 = function(a) {
            return 2+2;
        };

        testModel.on('read', f1);
        testModel.on('read', f2);
        expect(testModel.getEvents('read').length).toBe(2);

        testModel.off('read', f1);
        expect(testModel.getEvents('read').length).toBe(1);

        testModel.off('read');
        // Should remove all read listerns
        expect(!testModel.getEvents('read')).toBe(true);
    });
});

describe('Simple change detection', () => {
    let testModel;

    beforeEach(() => {
        testModel = makeTestnewModel();
    });

    test('Listen to value created by set', () => {
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('CREATE');
            expect(namespace).toBe('count');
            expect(updated).toBe(0);
        });

        testModel.set('count', 0);
    });

    test('Listen to value created directly', () => {
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('CREATE');
            expect(namespace).toBe('count');
            expect(updated).toBe(0);
        });

        testModel.count = 0;
    });

    test('Listen to value update', () => {
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('UPDATE');
            expect(namespace).toBe('name');
            expect(updated).toBe('Gertrude');
            expect(original).toBe('dave');
        });

        testModel.set('name', 'Gertrude');
    });

    test('Listen to value unchanged', () => {
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('NONE');
            expect(namespace).toBe('name');
            expect(updated).toBe('dave');
            expect(original).toBe('dave');
        });

        testModel.set('name', 'dave');
    });

    test('Listen to value change numeric', () => {
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('UPDATE');
            expect(namespace).toBe('name');
            expect(updated).toBe(0);
            expect(original).toBe('dave');
        });

        testModel.set('name', 0);
    });

    test('Listen to value change false', () => {
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('UPDATE');
            expect(namespace).toBe('name');
            expect(updated).toBe(false);
            expect(original).toBe('dave');
        });

        testModel.set('name', false);
    });

    test('Listen to value change null', () => {
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('UPDATE');
            expect(namespace).toBe('name');
            expect(updated).toBe(null);
            expect(original).toBe('dave');
        });

        testModel.set('name', null);
    });

    test('Listen to value remove', () => {
        let count = 0;

        testModel.on('all', (type, namespace, updated, original) => {
            count++;
            expect(type).toBe('REMOVE');
            expect(namespace).toBe('name');
            expect(updated).toBe(undefined);
            expect(original).toBe('dave');
        });

        delete testModel.name;
        expect(testModel.name).toBe(undefined);

        expect(count).toBe(1);
    });

    test('Listen to object update', () => {
        const namespaces = ['stuff.northwind', 'stuff'];
        const changes = ['UPDATE', 'UPDATE'];
        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        testModel.set('stuff.northwind', 'eggs');
    });

    test('Listen update object with new', () => {
        const namespaces = ['stuff.cheese', 'stuff'];
        const changes = ['CREATE', 'UPDATE'];

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        // cheese will log a CREATE
        // stuff will log its been UPDATED
        testModel.set('stuff.cheese', 'yes');
    });

    test('Listen update object with object', () => {
        testModel.set('testing', {'animal': 'cat', 'cake': 'yes'});

        // When replacing a object with another object, all old properties will trigger as removed.
        // the base object will consider itself updated and the new entity has created

        const namespaces = ['testing.platypus', 'testing.animal', 'testing.cake', 'testing'];
        const changes = ['CREATE', 'REMOVE', 'REMOVE', 'UPDATE'];

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        testModel.set('testing', {'platypus': false});
    });

    test('Listen update object with object with same object', () => {
        testModel.set('testing', {'animal': 'cat', 'cake': 'yes'});

        // When replacing with same object, everthing will consider itself unchanged

        const namespaces = ['testing.animal', 'testing.cake', 'testing'];
        const changes = ['NONE', 'NONE', 'NONE'];

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        testModel.set('testing', {'animal': 'cat', 'cake': 'yes'});
    });

    test('Listen update object with object with similar object', () => {
        testModel.set('testing', {'animal': 'cat', 'cake': 'no'});

        // cake value is changed, so object is changed.

        const namespaces = ['testing.animal', 'testing.cake', 'testing'];
        const changes = ['NONE', 'UPDATE', 'UPDATE'];

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        testModel.set('testing', {'animal': 'cat', 'cake': 'yes'});
    });

    test('Listen update object with empty string', () => {
        testModel.set('testing', {'animal': 'cat', 'cake': 'no'});
        // Remove old obj values & update testing to new.
        const namespaces = ['testing.animal', 'testing.cake', 'testing'];
        const changes = ['REMOVE', 'REMOVE', 'UPDATE'];

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        testModel.set('testing', '');
    });

    test('Make tree', () => {
        let callbackCount = 0;
        // Remove old obj values & update testing to new.
        const namespaces = ['a.b.c.d.e.f', 'a.b.c.d.e', 'a.b.c.d', 'a.b.c', 'a.b', 'a'];
        const changes = ['CREATE', 'CREATE', 'CREATE', 'CREATE', 'CREATE', 'CREATE'];

        testModel.on('all', (type, namespace, updated, original) => {
            callbackCount++;
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        testModel.set('a.b.c.d.e.f', 'Hi');

        // Fire only once per change
        expect(callbackCount).toBe(6);
    });

    test('Remove tree', () => {
        testModel.set('a.b.c.d.e.f', 'Hi');

        // Remove old obj values & update testing to new.
        const namespaces = ['a.b.c.d.e.f', 'a.b.c.d.e', 'a.b.c.d', 'a.b.c', 'a.b', 'a'];
        const changes = ['REMOVE', 'REMOVE', 'REMOVE', 'REMOVE', 'REMOVE', 'UPDATE'];

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe(changes.shift());
            expect(namespace).toBe(namespaces.shift());
        });

        testModel.set('a', {});
    });

    test('Wildcard new element', () => {
        let called = 0;

        testModel.set('players', [{'name': 'bob'}, {'name': 'sally'}]);

        testModel.on('create:players.*', (change) => {
            called++;
            expect(change.name).toBe('buzz');
        });

        testModel.set('players', [{'name': 'bob'}, {'name': 'sally'}, {'name': 'buzz'}]);

        expect(called).toBe(1);
    });

    test('Test simple array match', () => {
        testModel.set('abc', ['bob']);

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('NONE');
        });

        testModel.set('abc', ['bob']);
    });

    test('Test simple object match', () => {
        testModel.set('abc', {name: 'bob'});

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('NONE');
        });

        testModel.set('abc', {name: 'bob'});
    });

    test('Empty object match', () => {
        testModel.set('abc', []);

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('NONE');
        });

        testModel.set('abc', []);
    });

    test('Empty array match', () => {
        testModel.set('abc', []);

        testModel.on('all', (type, namespace, updated, original) => {
            expect(type).toBe('NONE');
        });

        testModel.set('abc', []);
    });
});

describe('Context events', () => {
    let testModel;

    beforeEach(() => {
        testModel = makeTestnewModel();
    });

    test('Context event simple', () => {
        const stuff = testModel.get('stuff');

        stuff.on('all', () => {});
        expect(Object.keys(testModel.getEvents())[0]).toBe('all:stuff');
    });

    test('Context event, sub object', () => {
        const stuff = testModel.get('stuff');

        stuff.on('change:name', () => {});
        expect(Object.keys(testModel.getEvents())[0]).toBe('change:stuff.name');
    });


    test('Add event listener directly to sub object', () => {
        const stuff = testModel.get('stuff');

        stuff.on('all', (type, updated, original) => {
            expect(type).toBe('UPDATE');
        });

        stuff.name = 'Harry';
    });

    test('Use get on a sub object', () => {
        testModel.set('test.testing', {'name': 'bobbert'});
        const testing = testModel.get('test.testing');

        expect(testing.get('name')).toBe('bobbert');
    });

    test('Detect object being removed using sub object event', () => {
        testModel.set('test.testing', {'name': 'bobbert'});
        const testing = testModel.get('test.testing');

        testing.on('all', (type, updated, original) => {
            expect(type).toBe('REMOVE');
        });

        testModel.set('test', {});
    });

    test('Set value on subobject', () => {
        testModel.set('test.testing', {'name': 'bobbert'});
        const testing = testModel.get('test.testing');

        testing.on('all', (type, updated, original) => {
            expect(type).toBe('UPDATE');
            expect(updated.name).toBe('Jane');
            expect(original.name).toBe('bobbert');
        });

        // testModel.set('test.testing', {'name': 'Jane'});
        testing.set('name', 'Jane');
    });

    test('Get context', () => {
        testModel.set('test.testing.1', {'name': 'bobbert'});
        const testing = testModel.get('test.testing.1');
        expect(testing.getContext()).toBe('test.testing.1');
    });

    test('Ensure orphaned object, still shows latest from datapath', () => {
        testModel.set('test', {'data': {name: 'abc'}});

        // When using a local obj, complete refresh of object can lead to it becoming
        // orphaned. Refresh model allows it to figure out its real version again.
        const data = testModel.get('test.data');

        testModel.set('test', {'data': {name: 'def'}});

        expect(data.name).toBe('def');
    });

    test('Ensure orphaned object handles no longer existing in datapath', () => {
        testModel.set('test', {'data': {name: 'abc'}});

        // When using a local obj, complete refresh of object can lead to it becoming
        // orphaned. Refresh model allows it to figure out its real version again.
        const data = testModel.get('test.data');

        testModel.set('test', {});

        expect(data.name).toBe(undefined);
    });

    test('Ensure orphaned object can set values correctly', () => {
        testModel.set('test', {'data': {name: 'abc'}});

        // When using a local obj, complete refresh of object can lead to it becoming
        // orphaned. Refresh model allows it to figure out its real version again.
        const data = testModel.get('test.data');
        testModel.set('test', {'data': {name: 'def'}});

        data.set('name', 'huh');

        expect(testModel.get('test.data.name')).toBe('huh');
    });

    test('Ensure orphaned object can set values correctly', () => {
        testModel.set('test', {'data': {name: 'abc'}});

        // When using a local obj, complete refresh of object can lead to it becoming
        // orphaned. Refresh model allows it to figure out its real version again.
        const data = testModel.get('test.data');
        testModel.set('test', {'data': {name: 'def'}});

        data.name = 'hmm';

        expect(testModel.get('test.data.name')).toBe('hmm');
    });

    test('Listener objects use proxy data not real data', () => {
        testModel.set('test.testing', {'name': 'bobbert'});
        const testing = testModel.get('test.testing');
        let count = 0;

        testing.on('update', (updated) => {
            count++;
            expect(updated.getContext()).toBe('test.testing');
        });

        testModel.set('test.testing', {'name': 'ziggy'});
        expect(count).toBe(1);
    });
});

describe('Listeners', () => {
    let testModel;

    beforeEach(() => {
        testModel = makeTestnewModel();
    });

    test('Add listener', () => {
        let count = 0;
        const events = [
            'update:name',
            'update:*',
            'change:name',
            'change:*',
            'all',
            'updated',
        ];
        const listener = {
            trigger(evt) {
                count++;
                expect(evt).toBe(events.shift());
            },
        };

        testModel.subscribe(listener);

        testModel.set('name', 'Bob');
        expect(count).toBe(6);
    });

    test('Add listener with namespace', () => {
        let count = 0;
        const events = [
            'potato:update:name',
            'potato:update:*',
            'potato:change:name',
            'potato:change:*',
            'potato:all',
            'potato:updated',
        ];
        const listener = {
            trigger(evt) {
                count++;
                expect(evt).toBe(events.shift());
            },
        };

        testModel.subscribe(listener, 'potato');

        testModel.set('name', 'Bob');
        expect(count).toBe(6);
    });

    test('remove listener', () => {
        let count = 0;
        const events = [
            // first listener
            'update:name',
            'test:update:name',
            'update:*',
            'test:update:*',
            'change:name',
            'test:change:name',
            'change:*',
            'test:change:*',
            'all',
            'test:all',
            'updated',
            'test:updated',
            // none namespaced sub removed
            'test:update:name',
            'test:update:*',
            'test:change:name',
            'test:change:*',
            'test:all',
            'test:updated',
        ];

        const listener = {
            trigger(evt) {
                count++;
                expect(evt).toBe(events.shift());
            },
        };

        testModel.subscribe(listener);
        testModel.subscribe(listener, 'test');

        testModel.set('name', 'Bob');
        expect(count).toBe(12);

        testModel.unsubscribe(listener);

        testModel.set('name', 'Jim');
        expect(count).toBe(18);

        testModel.unsubscribe(listener, 'test');

        testModel.set('name', 'Zippy');
        expect(count).toBe(18);
    });
});

describe('Native functionalty', () => {
    test('stringify', () => {
        const obj = {
            'hello': 'world',
            'test': [1, 2],
        };
        const test = newModel(obj);

        expect(JSON.stringify(test)).toBe(JSON.stringify(obj));
        expect(JSON.stringify(test.test)).toBe('[1,2]');
    });

    test('Object keys', () => {
        const obj = {
            'hello': 'world',
            'test': [1, 2],
        };
        const test = newModel(obj);

        expect(Object.keys(test)[0]).toBe('hello');
        expect(Object.keys(test)[1]).toBe('test');
    });

    test('Object values', () => {
        const obj = {
            'hello': 'world',
            'test': [1, 2],
        };
        const test = newModel(obj);

        expect(Object.values(test)[0]).toBe('world');
    });

    test('Object enteries', () => {
        const obj = {
            'hello': 'world',
            'test': [1, 2],
        };
        const test = newModel(obj);
        const result = Object.entries(test)[0];

        expect(result[0]).toBe('hello');
        expect(result[1]).toBe('world');
    });

    test('Array map', () => {
        let count = 0; let val = 1;
        const test = newModel({
            'test': [1, 2, 3],
        });

        test.test.map((v)=> {
            count++;
            expect(v).toBe(val++);
        });
        expect(count).toBe(3);
    });

    test('Spread', () => {
        const test = newModel({
            'test': [1, 2, 3],
        });

        const flat = [...test.test];
        expect(flat[0]).toBe(1);
        expect(flat[1]).toBe(2);
        expect(flat[2]).toBe(3);
    });
});

describe('Custom events', () => {
    test('Trigger custom event', () => {
        const testModel = makeTestnewModel();
        let called = 0;
        testModel.on('magic:helloworld', (d) => {
            expect(d.id).toBe(123);
            called++;
        });

        testModel.trigger('magic:helloworld', {id: 123});

        expect(called).toBe(1);
    });

    test('Trigger custom event via defer', () => {
        const testModel = makeTestnewModel();
        const stuff = testModel.get('stuff');

        let called = 0;
        stuff.on('magic', (d) => {
            expect(d.id).toBe(123);
            called++;
        });

        stuff.trigger('magic', {id: 123});

        expect(called).toBe(1);
    });
});

describe('Functions', () => {
    test('Can store functions', () => {
        const model = newModel({'name': 'bob'});

        model.set('abc', function() {
            return 'yarr';
        });
        model.set('echo', function(v) {
            return v;
        });

        expect(model.get('abc')()).toBe('yarr');
        expect(model.get('echo')('test')).toBe('test');
        expect(model.abc()).toBe('yarr');
        expect(model.echo('test')).toBe('test');
    });

    test('Can change function', () => {
        const model = newModel({'name': 'bob'});
        const method = function(v) {
            return v;
        };

        const types = [
            'CREATE',
            // No event on no change.
            'UPDATE',
        ];

        model.on('change:echo', (type, n, o) => {
            expect(type).toBe(types.shift());
        });

        model.set('echo', method);
        model.set('echo', method);
        model.set('echo', function(v) {
            return v;
        });
    });
});
