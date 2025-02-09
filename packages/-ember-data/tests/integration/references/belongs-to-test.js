import { defer, resolve } from 'rsvp';
import { run } from '@ember/runloop';
import { get } from '@ember/object';
import DS from 'ember-data';
import { setupTest } from 'ember-qunit';
import testInDebug from '@ember-data/unpublished-test-infra/test-support/test-in-debug';
import { module, test } from 'qunit';
import JSONAPISerializer from '@ember-data/serializer/json-api';
import JSONAPIAdapter from '@ember-data/adapter/json-api';

module('integration/references/belongs-to', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    const Family = DS.Model.extend({
      persons: DS.hasMany(),
      name: DS.attr(),
    });

    const Person = DS.Model.extend({
      family: DS.belongsTo({ async: true }),
    });

    this.owner.register('model:family', Family);
    this.owner.register('model:person', Person);

    this.owner.register('adapter:application', JSONAPIAdapter.extend());
    this.owner.register('serializer:application', JSONAPISerializer.extend());
  });

  testInDebug("record#belongsTo asserts when specified relationship doesn't exist", function(assert) {
    let store = this.owner.lookup('service:store');

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
        },
      });
    });

    assert.expectAssertion(function() {
      run(function() {
        person.belongsTo('unknown-relationship');
      });
    }, "There is no belongsTo relationship named 'unknown-relationship' on a model of modelClass 'person'");
  });

  testInDebug("record#belongsTo asserts when the type of the specified relationship isn't the requested one", function(
    assert
  ) {
    let store = this.owner.lookup('service:store');

    var family;
    run(function() {
      family = store.push({
        data: {
          type: 'family',
          id: 1,
        },
      });
    });

    assert.expectAssertion(function() {
      run(function() {
        family.belongsTo('persons');
      });
    }, "You tried to get the 'persons' relationship on a 'family' via record.belongsTo('persons'), but the relationship is of kind 'hasMany'. Use record.hasMany('persons') instead.");
  });

  test('record#belongsTo', function(assert) {
    let store = this.owner.lookup('service:store');

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');

    assert.equal(familyReference.remoteType(), 'id');
    assert.equal(familyReference.type, 'family');
    assert.equal(familyReference.id(), 1);
  });

  test('record#belongsTo for a linked reference', function(assert) {
    let store = this.owner.lookup('service:store');

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              links: { related: '/families/1' },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');

    assert.equal(familyReference.remoteType(), 'link');
    assert.equal(familyReference.type, 'family');
    assert.equal(familyReference.link(), '/families/1');
  });

  test('BelongsToReference#parent is a reference to the parent where the relationship is defined', function(assert) {
    let store = this.owner.lookup('service:store');

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
    });

    var personReference = store.getReference('person', 1);
    var familyReference = person.belongsTo('family');

    assert.ok(personReference);
    assert.equal(familyReference.parent, personReference);
  });

  test('BelongsToReference#meta() returns the most recent meta for the relationship', function(assert) {
    let store = this.owner.lookup('service:store');

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              links: {
                related: '/families/1',
              },
              meta: {
                foo: true,
              },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');
    assert.deepEqual(familyReference.meta(), { foo: true });
  });

  test('push(object)', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let Family = store.modelFor('family');

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');

    run(function() {
      var data = {
        data: {
          type: 'family',
          id: 1,
          attributes: {
            name: 'Coreleone',
          },
        },
      };

      familyReference.push(data).then(function(record) {
        assert.ok(Family.detectInstance(record), 'push resolves with the referenced record');
        assert.equal(get(record, 'name'), 'Coreleone', 'name is set');

        done();
      });
    });
  });

  testInDebug('push(record)', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');

    var person, family;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
      family = store.push({
        data: {
          type: 'family',
          id: 1,
          attributes: {
            name: 'Coreleone',
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');
    let Family = store.modelFor('family');

    run(function() {
      familyReference.push(family).then(function(record) {
        assert.ok(Family.detectInstance(record), 'push resolves with the referenced record');
        assert.equal(get(record, 'name'), 'Coreleone', 'name is set');
        assert.equal(record, family);

        done();
      });
    });
  });

  test('push(promise)', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let Family = store.modelFor('family');

    var push;
    var deferred = defer();

    run(function() {
      var person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
      var familyReference = person.belongsTo('family');
      push = familyReference.push(deferred.promise);
    });

    assert.ok(push.then, 'BelongsToReference.push returns a promise');

    run(function() {
      deferred.resolve({
        data: {
          type: 'family',
          id: 1,
          attributes: {
            name: 'Coreleone',
          },
        },
      });
    });

    run(function() {
      push.then(function(record) {
        assert.ok(Family.detectInstance(record), 'push resolves with the record');
        assert.equal(get(record, 'name'), 'Coreleone', 'name is updated');

        done();
      });
    });
  });

  testInDebug('push(record) asserts for invalid modelClass', function(assert) {
    let store = this.owner.lookup('service:store');

    var person, anotherPerson;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
      anotherPerson = store.push({
        data: {
          type: 'person',
          id: 2,
        },
      });
    });

    var familyReference = person.belongsTo('family');

    assert.expectAssertion(function() {
      run(function() {
        familyReference.push(anotherPerson);
      });
    }, "The 'person' type does not implement 'family' and thus cannot be assigned to the 'family' relationship in 'person'. Make it a descendant of 'family' or use a mixin of the same name.");
  });

  testInDebug('push(record) works with polymorphic modelClass', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let Family = store.modelFor('family');

    var person, mafiaFamily;

    this.owner.register('model:mafia-family', Family.extend());

    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
        },
      });
      mafiaFamily = store.push({
        data: {
          type: 'mafia-family',
          id: 1,
        },
      });
    });

    var familyReference = person.belongsTo('family');
    run(function() {
      familyReference.push(mafiaFamily).then(function(family) {
        assert.equal(family, mafiaFamily);

        done();
      });
    });
  });

  test('value() is null when reference is not yet loaded', function(assert) {
    let store = this.owner.lookup('service:store');

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');
    assert.strictEqual(familyReference.value(), null);
  });

  test('value() returns the referenced record when loaded', function(assert) {
    let store = this.owner.lookup('service:store');

    var person, family;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
      family = store.push({
        data: {
          type: 'family',
          id: 1,
        },
      });
    });

    var familyReference = person.belongsTo('family');
    assert.equal(familyReference.value(), family);
  });

  test('value() returns the referenced record when loaded even if links are present', function(assert) {
    let store = this.owner.lookup('service:store');

    var person, family;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
      family = store.push({
        data: {
          type: 'family',
          id: 1,
          relationships: {
            persons: {
              links: {
                related: '/this/should/not/matter',
              },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');
    assert.equal(familyReference.value(), family);
  });

  test('load() fetches the record', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let adapter = store.adapterFor('application');

    const adapterOptions = { thing: 'one' };

    adapter.findRecord = function(store, type, id, snapshot) {
      assert.equal(snapshot.adapterOptions, adapterOptions, 'adapterOptions are passed in');
      return resolve({
        data: {
          id: 1,
          type: 'family',
          attributes: { name: 'Coreleone' },
        },
      });
    };

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');

    run(function() {
      familyReference.load({ adapterOptions }).then(function(record) {
        assert.equal(get(record, 'name'), 'Coreleone');

        done();
      });
    });
  });

  test('load() fetches link when remoteType is link', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let adapter = store.adapterFor('application');

    const adapterOptions = { thing: 'one' };

    adapter.findBelongsTo = function(store, snapshot, link) {
      assert.equal(snapshot.adapterOptions, adapterOptions, 'adapterOptions are passed in');
      assert.equal(link, '/families/1');

      return resolve({
        data: {
          id: 1,
          type: 'family',
          attributes: { name: 'Coreleone' },
        },
      });
    };

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              links: { related: '/families/1' },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');
    assert.equal(familyReference.remoteType(), 'link');

    run(function() {
      familyReference.load({ adapterOptions }).then(function(record) {
        assert.equal(get(record, 'name'), 'Coreleone');

        done();
      });
    });
  });

  test('reload() - loads the record when not yet loaded', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let adapter = store.adapterFor('application');

    const adapterOptions = { thing: 'one' };

    var count = 0;
    adapter.findRecord = function(store, type, id, snapshot) {
      assert.equal(snapshot.adapterOptions, adapterOptions, 'adapterOptions are passed in');

      count++;
      assert.equal(count, 1);

      return resolve({
        data: {
          id: 1,
          type: 'family',
          attributes: { name: 'Coreleone' },
        },
      });
    };

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');

    run(function() {
      familyReference.reload({ adapterOptions }).then(function(record) {
        assert.equal(get(record, 'name'), 'Coreleone');

        done();
      });
    });
  });

  test('reload() - reloads the record when already loaded', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let adapter = store.adapterFor('application');

    const adapterOptions = { thing: 'one' };

    var count = 0;
    adapter.findRecord = function(store, type, id, snapshot) {
      assert.equal(snapshot.adapterOptions, adapterOptions, 'adapterOptions are passed in');

      count++;
      assert.equal(count, 1);

      return resolve({
        data: {
          id: 1,
          type: 'family',
          attributes: { name: 'Coreleone' },
        },
      });
    };

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              data: { type: 'family', id: 1 },
            },
          },
        },
      });
      store.push({
        data: {
          type: 'family',
          id: 1,
        },
      });
    });

    var familyReference = person.belongsTo('family');

    run(function() {
      familyReference.reload({ adapterOptions }).then(function(record) {
        assert.equal(get(record, 'name'), 'Coreleone');

        done();
      });
    });
  });

  test('reload() - uses link to reload record', function(assert) {
    var done = assert.async();

    let store = this.owner.lookup('service:store');
    let adapter = store.adapterFor('application');

    const adapterOptions = { thing: 'one' };

    adapter.findBelongsTo = function(store, snapshot, link) {
      assert.equal(snapshot.adapterOptions, adapterOptions, 'adapterOptions are passed in');

      assert.equal(link, '/families/1');

      return resolve({
        data: {
          id: 1,
          type: 'family',
          attributes: { name: 'Coreleone' },
        },
      });
    };

    var person;
    run(function() {
      person = store.push({
        data: {
          type: 'person',
          id: 1,
          relationships: {
            family: {
              links: { related: '/families/1' },
            },
          },
        },
      });
    });

    var familyReference = person.belongsTo('family');

    run(function() {
      familyReference.reload({ adapterOptions }).then(function(record) {
        assert.equal(get(record, 'name'), 'Coreleone');

        done();
      });
    });
  });
});
