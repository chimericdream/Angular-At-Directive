/* global angular */
(function(ng, w, d, undefined) {
    'use strict';

    var caret = ng.module('ngCaret', []);

    caret.factory('CaretUtils', [
        function() {
            function CaretUtils() {}

            CaretUtils.prototype.adjustOffset = function(offset, input) {
                if (!offset) {
                    return;
                }
                offset.top += w.scrollY + input[0].scrollTop;
                offset.left += +w.scrollX + input[0].scrollLeft;
                return offset;
            };

            CaretUtils.prototype.contentEditable = function(input) {
                return !!(input[0].contentEditable && input[0].contentEditable === 'true');
            };

            return new CaretUtils();
        }
    ]);

    caret.factory('Mirror', [
        function() {
            function Mirror() {
                this.cssAttr = [
                    'overflow-y',
                    'height',
                    'width',
                    'padding-top',
                    'padding-left',
                    'padding-right',
                    'padding-bottom',
                    'margin-top',
                    'margin-left',
                    'margin-right',
                    'margin-bottom',
                    'font-family',
                    'border-style',
                    'border-width',
                    'word-wrap',
                    'font-size',
                    'line-height',
                    'overflow-x',
                    'text-align'
                ];
            }

            Mirror.prototype.mirrorCss = function(el) {
                var css = {
                    'position': 'absolute',
                    'left': -9999,
                    'top': 0,
                    'z-index': -20000,
                    'white-space': 'pre-wrap'
                };
                ng.forEach(this.cssAttr, function(value) {
                    css[value] = el.css(value);
                });
                return css;
            };

            Mirror.prototype.create = function(el, html) {
                this.mirror = ng.element('<div></div>');
                this.mirror.css(this.mirrorCss(el));
                this.mirror.html(html);
                el.after(this.mirror);
                return this;
            };

            Mirror.prototype.rect = function() {
                var flag, pos, rect;

                flag = this.mirror.find('#caret');
                pos = flag.position();
                rect = {
                    left: pos.left,
                    top: pos.top,
                    height: flag.height()
                };
                this.mirror.remove();
                return rect;
            };

            return new Mirror();
        }
    ]);

    caret.factory('EditableCaret', [
        'CaretUtils',
        function(CaretUtils) {
            function EditableCaret() {}

            EditableCaret.prototype.range = function() {
                var sel;

                if (!w.getSelection) {
                    return;
                }
                sel = w.getSelection();
                if (sel.rangeCount > 0) {
                    return sel.getRangeAt(0);
                } else {
                    return null;
                }
            };

            EditableCaret.prototype.getPos = function(element) {
                var clonedRange, pos, range;
                range = this.range();
                if (range) {
                    clonedRange = range.cloneRange();
                    clonedRange.selectNodeContents(element[0]);
                    clonedRange.setEnd(range.endContainer, range.endOffset);
                    pos = clonedRange.toString().length;
                    clonedRange.detach();
                    return pos;
                } else if (d.selection) {
                    return this.getOldIEPos(element);
                }
            };

            EditableCaret.prototype.getOldIEPos = function(element) {
                var preCaretTextRange, textRange;

                textRange = d.selection.createRange();
                preCaretTextRange = d.body.createTextRange();
                preCaretTextRange.moveToElementText(element[0]);
                preCaretTextRange.setEndPoint('EndToEnd', textRange);
                return preCaretTextRange.text.length;
            };

            EditableCaret.prototype.setPos = function(element) {
                return element[0];
            };

            EditableCaret.prototype.getOffset = function(element) {
                var clonedRange, offset, range, rect;

                offset = null;
                range = this.range();
                if (w.getSelection && range) {
                    clonedRange = range.cloneRange();
                    clonedRange.setStart(range.endContainer, Math.max(1, range.endOffset) - 1);
                    clonedRange.setEnd(range.endContainer, range.endOffset);
                    rect = clonedRange.getBoundingClientRect();
                    offset = {
                        height: rect.height,
                        left: rect.left + rect.width,
                        top: rect.top
                    };
                    clonedRange.detach();
                } else if (d.selection) {
                    this.getOldIEOffset();
                }
                return CaretUtils.adjustOffset(offset, element);
            };

            EditableCaret.prototype.getOldIEOffset = function() {
                var range, rect;

                range = d.selection.createRange().duplicate();
                range.moveStart('character', -1);
                rect = range.getBoundingClientRect();
                return {
                    height: rect.bottom - rect.top,
                    left: rect.left,
                    top: rect.top
                };
            };

            return new EditableCaret(CaretUtils);
        }
    ]);

    caret.factory('InputCaret', [
        'Mirror', 'CaretUtils',
        function(Mirror, CaretUtils) {
            function InputCaret() {}

            InputCaret.prototype.getPos = function(el) {
                if (d.selection) {
                    return this.getIEPos(el);
                } else {
                    return el[0].selectionStart;
                }
            };

            InputCaret.prototype.getIEPos = function(el) {
                var endRange, input, len, normalizedValue, pos, range, textInputRange;

                input = el[0];
                range = d.selection.createRange();
                pos = 0;
                if (range && range.parentElement() === input) {
                    normalizedValue = input.value.replace(/\r\n/g, '\n');
                    len = normalizedValue.length;
                    textInputRange = input.createTextRange();
                    textInputRange.moveToBookmark(range.getBookmark());
                    endRange = input.createTextRange();
                    endRange.collapse(false);
                    if (textInputRange.compareEndPoints('StartToEnd', endRange) > -1) {
                        pos = len;
                    } else {
                        pos = -textInputRange.moveStart('character', -len);
                    }
                }
                return pos;
            };

            InputCaret.prototype.setPos = function(el, pos) {
                var input, range;

                input = el[0];
                if (d.selection) {
                    range = input.createTextRange();
                    range.move('character', pos);
                    range.select();
                } else if (input.setSelectionRange) {
                    input.setSelectionRange(pos, pos);
                }
                return input;
            };

            InputCaret.prototype.getPosition = function(el, pos) {
                var input, atRect, format, h, html, startRange, x, y;

                input = el;
                format = function(value) {
                    return value.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/`/g, '&#96;').replace(/'/g, '&quot;').replace(/\r\n|\r|\n/g, '<br>');
                };
                if (ng.isUndefined(pos)) {
                    pos = this.getPos(input);
                }
                startRange = input.val().slice(0, pos);
                html = '<span>' + format(startRange) + '</span>';
                html += '<span id="caret">|</span>';
                atRect = Mirror.create(input, html).rect();
                x = atRect.left - input[0].scrollLeft;
                y = atRect.top - input[0].scrollTop;
                h = atRect.height;
                return {
                    left: x,
                    top: y,
                    height: h
                };
            };

            InputCaret.prototype.getOffset = function(el, pos) {
                var input, offset, position;

                input = el;
                if (d.selection) {
                    return CaretUtils.adjustOffset(this.getIEOffset(input, pos), input);
                } else {
                    offset = input.offset();
                    position = this.getPosition(el, pos);
                    offset = {
                        left: offset.left + position.left,
                        top: offset.top + position.top,
                        height: position.height
                    };
                    return offset;
                }
            };

            InputCaret.prototype.getIEOffset = function(el, pos) {
                var h, range, textRange, x, y;

                textRange = el[0].createTextRange();
                if (pos) {
                    textRange.move('character', pos);
                } else {
                    range = d.selection.createRange();
                    textRange.moveToBookmark(range.getBookmark());
                }
                x = textRange.boundingLeft;
                y = textRange.boundingTop;
                h = textRange.boundingHeight;
                return {
                    left: x,
                    top: y,
                    height: h
                };
            };

            return new InputCaret();
        }
    ]);

    caret.factory('Caret', [
        'InputCaret', 'EditableCaret',
        function(InputCaret, EditableCaret) {
            function Caret() {}

            Caret.prototype.getPos = function(el) {
                if (el.attr('contenteditable') === 'true') {
                    return EditableCaret.getPos(el);
                } else {
                    return InputCaret.getPos(el);
                }
            };

            Caret.prototype.setPos = function(el, pos) {
                if (el.attr('contenteditable') === 'true') {
                    return EditableCaret.setPos(el, pos);
                } else {
                    return InputCaret.setPos(el, pos);
                }
            };

            Caret.prototype.getOffset = function(el) {
                if (el.attr('contenteditable') === 'true') {
                    return EditableCaret.getOffset(el);
                } else {
                    return InputCaret.getOffset(el);
                }
            };

            return new Caret();
        }
    ]);
})(angular, window, document);
