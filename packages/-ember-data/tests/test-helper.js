import Application from '../app';
import config from '../config/environment';
import RSVP from 'rsvp';
import { setApplication } from '@ember/test-helpers';
import { start } from 'ember-qunit';
import { DEBUG } from '@glimmer/env';

import QUnit from 'qunit';
import { wait, asyncEqual, invokeAsync } from '@ember-data/unpublished-test-infra/test-support/async';
import configureAsserts from '@ember-data/unpublished-test-infra/test-support/qunit-asserts';

if (window.Promise === undefined) {
  window.Promise = RSVP.Promise;
}

configureAsserts();

setApplication(Application.create(config.APP));

const { assert } = QUnit;

QUnit.begin(() => {
  function assertAllDeprecations(assert) {
    if (typeof assert.test.expected === 'number') {
      assert.test.expected += 1;
    }
    assert.expectNoDeprecation(undefined, undefined, deprecation => {
      // only assert EmberData deprecations
      const id = deprecation.options.id.toLowerCase();
      const isEmberDataDeprecation =
        id.includes('ds.') ||
        id.includes('emberdata') ||
        id.includes('ember-data') ||
        id.includes('mismatched-inverse-relationship-data-from-payload');

      if (!isEmberDataDeprecation) {
        // eslint-disable-next-line no-console
        console.warn('Detected Non-Ember-Data Deprecation:', deprecation.message, deprecation.options.stacktrace);
      }

      return isEmberDataDeprecation;
    });
  }
  // ensure we don't regress quietly
  // this plays nicely with `expectDeprecation`
  if (DEBUG) {
    QUnit.config.modules.forEach(mod => {
      const hooks = (mod.hooks.afterEach = mod.hooks.afterEach || []);

      if (mod.tests.length !== 0) {
        hooks.unshift(assertAllDeprecations);
      }
    });
  }

  RSVP.configure('onerror', reason => {
    // only print error messages if they're exceptions;
    // otherwise, let a future turn of the event loop
    // handle the error.
    // TODO kill this off
    if (reason && reason instanceof Error) {
      throw reason;
    }
  });
});

assert.wait = wait;
assert.asyncEqual = asyncEqual;
assert.invokeAsync = invokeAsync;
assert.assertClean = function(promise) {
  return promise.then(
    this.wait(record => {
      this.equal(record.get('hasDirtyAttributes'), false, 'The record is now clean');
      return record;
    })
  );
};

assert.contains = function(array, item) {
  this.ok(array.indexOf(item) !== -1, `array contains ${item}`);
};

assert.without = function(array, item) {
  this.ok(array.indexOf(item) === -1, `array doesn't contain ${item}`);
};

QUnit.config.testTimeout = 2000;
QUnit.config.urlConfig.push({
  id: 'enableoptionalfeatures',
  label: 'Enable Opt Features',
});
start({ setupTestIsolationValidation: true });
