import { ThemeColor } from '../../test/__mocks__/vscode';
import {
  Heading1DecorationType,
  Heading2DecorationType,
  LinkDecorationType,
  BlockquoteDecorationType,
  ListItemDecorationType,
  OrderedListItemDecorationType,
  CodeDecorationType,
  BoldDecorationType,
  ItalicDecorationType,
  BoldItalicDecorationType,
  ImageDecorationType,
  HorizontalRuleDecorationType,
  CheckboxUncheckedDecorationType,
  CheckboxCheckedDecorationType,
} from '../../decorations';

describe('decoration creation with color (hex vs theme)', () => {
  describe('heading decorations (US1)', () => {
    it('creates heading decoration with hex color', () => {
      const dt = Heading1DecorationType('#e06c75');
      expect(dt).toBeDefined();
      expect(typeof dt).toBe('object');
    });

    it('creates heading decoration with ThemeColor (theme-derived fallback)', () => {
      const dt = Heading1DecorationType(new ThemeColor('editor.foreground'));
      expect(dt).toBeDefined();
    });

    it('creates heading decoration with undefined (theme fallback)', () => {
      const dt = Heading1DecorationType();
      expect(dt).toBeDefined();
    });

    it('all heading levels accept optional color', () => {
      expect(Heading1DecorationType('#f00')).toBeDefined();
      expect(Heading2DecorationType()).toBeDefined();
      expect(Heading1DecorationType(new ThemeColor('editor.foreground'))).toBeDefined();
    });
  });

  describe('syntax decorations (US2)', () => {
    it('creates link decoration with hex and without', () => {
      expect(LinkDecorationType('#61afef')).toBeDefined();
      expect(LinkDecorationType()).toBeDefined();
      expect(LinkDecorationType(new ThemeColor('textLink.foreground'))).toBeDefined();
    });

    it('creates blockquote, list, code, emphasis decorations with hex or theme fallback', () => {
      expect(BlockquoteDecorationType('#98c379')).toBeDefined();
      expect(BlockquoteDecorationType()).toBeDefined();
      expect(ListItemDecorationType('#abb2bf')).toBeDefined();
      expect(ListItemDecorationType()).toBeDefined();
      expect(OrderedListItemDecorationType('#abb2bf')).toBeDefined();
      expect(OrderedListItemDecorationType()).toBeDefined();
      expect(CodeDecorationType('#e5c07b')).toBeDefined();
      expect(CodeDecorationType()).toBeDefined();
      expect(BoldDecorationType('#e06c75')).toBeDefined();
      expect(BoldDecorationType()).toBeDefined();
      expect(ItalicDecorationType('#d19a66')).toBeDefined();
      expect(ItalicDecorationType()).toBeDefined();
      expect(BoldItalicDecorationType('#c678dd')).toBeDefined();
      expect(BoldItalicDecorationType()).toBeDefined();
    });

    it('creates image, horizontal rule, checkbox decorations with hex or theme fallback', () => {
      expect(ImageDecorationType('#61afef')).toBeDefined();
      expect(ImageDecorationType()).toBeDefined();
      expect(ImageDecorationType(new ThemeColor('textLink.foreground'))).toBeDefined();
      expect(HorizontalRuleDecorationType('#5c6370')).toBeDefined();
      expect(HorizontalRuleDecorationType()).toBeDefined();
      expect(HorizontalRuleDecorationType(new ThemeColor('editorWidget.border'))).toBeDefined();
      expect(CheckboxUncheckedDecorationType('#abb2bf')).toBeDefined();
      expect(CheckboxUncheckedDecorationType()).toBeDefined();
      expect(CheckboxCheckedDecorationType('#98c379')).toBeDefined();
      expect(CheckboxCheckedDecorationType()).toBeDefined();
    });
  });

  describe('CodeDecorationType backgroundColor parameter', () => {
    it('creates code decoration with color only (uses default background)', () => {
      expect(CodeDecorationType('#e5c07b')).toBeDefined();
    });

    it('creates code decoration with backgroundColor only', () => {
      expect(CodeDecorationType(undefined, '#f0f0f0')).toBeDefined();
    });

    it('creates code decoration with both color and backgroundColor', () => {
      expect(CodeDecorationType('#e5c07b', '#f0f0f0')).toBeDefined();
    });

    it('creates code decoration with undefined backgroundColor (uses default)', () => {
      expect(CodeDecorationType('#e5c07b', undefined)).toBeDefined();
      expect(CodeDecorationType()).toBeDefined();
    });

    it('creates code decoration with ThemeColor background', () => {
      expect(CodeDecorationType('#e5c07b', new ThemeColor('editor.background'))).toBeDefined();
      expect(CodeDecorationType(undefined, new ThemeColor('editor.background'))).toBeDefined();
    });
  });
});
