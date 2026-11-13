import { describe, expect, it } from 'vitest';
import { globToRegExp, matchGlob } from '../src/glob.js';

describe('matchGlob', () => {
  it('matches hashed file names with *', () => {
    expect(matchGlob('assets/index-*.js', 'assets/index-D1LtzFCC.js')).toBe(true);
    expect(matchGlob('assets/index-*.js', 'assets/index-D1LtzFCC.css')).toBe(false);
    expect(matchGlob('assets/index-*.js', 'assets/vendor-D1LtzFCC.js')).toBe(false);
  });

  it('does not let * cross directory boundaries', () => {
    expect(matchGlob('*.js', 'main.js')).toBe(true);
    expect(matchGlob('*.js', 'js/main.js')).toBe(false);
  });

  it('matches any depth with **', () => {
    expect(matchGlob('**/*.js', 'main.js')).toBe(true);
    expect(matchGlob('**/*.js', 'js/main.js')).toBe(true);
    expect(matchGlob('**/*.js', 'static/js/chunks/main.js')).toBe(true);
    expect(matchGlob('js/**', 'js/a/b.js')).toBe(true);
    expect(matchGlob('js/**', 'css/a.css')).toBe(false);
  });

  it('matches a single character with ?', () => {
    expect(matchGlob('js/?.js', 'js/a.js')).toBe(true);
    expect(matchGlob('js/?.js', 'js/ab.js')).toBe(false);
    expect(matchGlob('js/?.js', 'js//.js')).toBe(false);
  });

  it('treats regular expression characters literally', () => {
    expect(matchGlob('a.js', 'a.js')).toBe(true);
    expect(matchGlob('a.js', 'abjs')).toBe(false);
    expect(matchGlob('chunk[1](2)+.js', 'chunk[1](2)+.js')).toBe(true);
    expect(matchGlob('{a,b}.js', 'a.js')).toBe(false);
  });

  it('matches the whole path, not a substring', () => {
    expect(matchGlob('main.js', 'js/main.js')).toBe(false);
    expect(matchGlob('main', 'main.js')).toBe(false);
  });

  it('matches chunk names, which have no directories', () => {
    expect(matchGlob('vendor', 'vendor')).toBe(true);
    expect(matchGlob('vendor*', 'vendor-react')).toBe(true);
  });
});

describe('globToRegExp', () => {
  it('anchors the expression', () => {
    expect(globToRegExp('*.css').source).toBe('^[^/]*\\.css$');
  });
});
