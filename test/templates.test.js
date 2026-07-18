'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Handlebars = require('handlebars');

test('all Handlebars templates compile', () => {
    const files = fs.readdirSync(path.join(__dirname, '..', 'views'), { recursive: true })
        .filter(file => file.endsWith('.hbs'));
    assert.ok(files.length > 0);
    for (const file of files) {
        const source = fs.readFileSync(path.join(__dirname, '..', 'views', file), 'utf8');
        assert.doesNotThrow(() => Handlebars.precompile(source), file);
    }
});
