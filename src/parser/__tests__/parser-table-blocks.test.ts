import { describe, expect, it } from 'vitest';
import { MarkdownParser } from '../core';
import { createCRLFText, normalizeToLF } from './helpers/crlf-helpers';

describe('parser table blocks', () => {
  const parser = new MarkdownParser();

  it('extracts plain-text table blocks for custom rendering', () => {
    const md = [
      '| Name | Role |',
      '|------|------|',
      '| Ada  | Lead |',
      '| Bob  | Dev  |',
    ].join('\n');

    const result = parser.extractDecorationsWithScopes(md);
    expect(result.tableBlocks).toHaveLength(1);
    expect(result.tableBlocks[0].header).toEqual(['Name', 'Role']);
    expect(result.tableBlocks[0].rows).toEqual([
      ['Ada', 'Lead'],
      ['Bob', 'Dev'],
    ]);
  });

  it('extracts plain text from cells with mixed inline formatting', () => {
    const md = [
      '| Plain | **Bold** and text |',
      '|-------|-------------------|',
      '| ok    | mixed             |',
    ].join('\n');

    const result = parser.extractDecorationsWithScopes(md);
    expect(result.tableBlocks).toHaveLength(1);
    expect(result.tableBlocks[0].header).toEqual(['Plain', 'Bold and text']);
    expect(result.tableBlocks[0].rows).toEqual([
      ['ok', 'mixed'],
    ]);
  });

  it('has correct startPos/endPos with CRLF line endings', () => {
    const lfTable = [
      '| Name | Role |',
      '|------|------|',
      '| Ada  | Lead |',
      '| Bob  | Dev  |',
    ].join('\n');
    const markdown = createCRLFText(lfTable);
    const normalized = normalizeToLF(markdown);

    const result = parser.extractDecorationsWithScopes(markdown);
    expect(result.tableBlocks).toHaveLength(1);

    const block = result.tableBlocks[0];
    expect(block.startPos).toBeGreaterThanOrEqual(0);
    expect(block.endPos).toBeLessThanOrEqual(normalized.length);
    expect(block.endPos).toBeGreaterThan(block.startPos);

    const tableText = normalized.slice(block.startPos, block.endPos);
    expect(tableText).toBe(lfTable);
    expect(block.header).toEqual(['Name', 'Role']);
    expect(block.rows).toEqual([
      ['Ada', 'Lead'],
      ['Bob', 'Dev'],
    ]);
  });
});
