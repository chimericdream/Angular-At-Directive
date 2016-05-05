/* global angular */
(function(ng, w, d, undefined) {
    'use strict';

    var at = ng.module('At', ['ngCaret']);

    at.factory('AtUtils', [
        function() {
            function AtUtils() {
                this.range = null;
            }

            AtUtils.prototype.markRange = function() {
                this.range = this.getRange() || this.getIERange();
                return this.range;
            };

            AtUtils.prototype.getRange = function() {
                return w.getSelection ? w.getSelection().getRangeAt(0) : undefined;
            };

            AtUtils.prototype.getIERange = function() {
                return d.selection ? d.selection.createRange() : undefined;
            };

            AtUtils.prototype.getContent = function(el) {
                if (el.attr('contenteditable') === 'true') {
                    return el.text();
                } else {
                    return el.val();
                }
            };

            AtUtils.prototype.query = function(subtext, flag) {
                var re, match;

                re = new RegExp(flag + '([A-Za-z0-9_\\+\\-]*)$|' + flag + '([^\\x00-\\xff]*)$', 'gi');
                match = re.exec(subtext);

                if (match) {
                    return match[2] || match[1];
                } else {
                    return null;
                }
            };

            AtUtils.prototype.insert = function(el, content, data, query, range) {
                var insertNode, pos, sel, source, startStr, text, flag = '@';
                if (el.attr('contenteditable') === 'true') {
                    insertNode = ng.element('<span contenteditable="false">' + flag + data + '&nbsp;</span>');

                    if (w.getSelection) {
                        pos = range.startOffset - (query.endPos - query.headPos) - 1;
                        range.setStart(range.endContainer, Math.max(pos, 0));
                        range.setEnd(range.endContainer, range.endOffset);
                        range.deleteContents();
                        range.insertNode(insertNode[0]);
                        range.collapse(false);
                        sel = w.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else if (d.selection) {
                        range.moveStart('character', query.endPos - query.headPos - 1);
                        range.pasteHTML(insertNode[0]);
                        range.collapse(false);
                        range.select();
                    }
                } else {
                    source = el.val();
                    startStr = source.slice(0, Math.max(query.headPos - 1, 0));
                    text = startStr + flag + data + ' ' + (source.slice(query.endPos || 0));
                    el.val(text);
                }
            };

            AtUtils.prototype.select = {
                prev: function(cur, lists) {
                    var prev;

                    cur.removeClass('list-cur');
                    prev = cur.prev();
                    if (!prev.length) {
                        prev = lists.last();
                    }
                    return prev.addClass('list-cur');
                },
                next: function(cur, lists) {
                    var next;

                    cur.removeClass('list-cur');
                    next = cur.next();
                    if (!next.length) {
                        next = lists.first();
                    }

                    return next.addClass('list-cur');
                },
                choose: function(cur) {
                    var content;

                    cur.removeClass('list-cur');
                    content = cur.find('span').text();

                    return content;
                }
            };

            return new AtUtils();
        }
    ]);

    at.directive('atUser', [
        'Caret', 'AtUtils',
        function(Caret, AtUtils) {
            function AtUser() {
                this.restrict = 'EA';
            }

            AtUser.prototype.link = function(scope, el, attrs) {
                var subtext, caretOffset;
                var flag = attrs.flag || '@';
                var lineHeight = scope.lineHeight || 16;
                scope.isAtListHidden = true;

                scope.$watch(
                    function() {
                        return scope.caretPos;
                    },
                    function(nowCaretPos) {
                        if (ng.isDefined(nowCaretPos)) {
                            scope.content = AtUtils.getContent(el);
                            subtext = scope.content.slice(0, nowCaretPos);
                            scope.query = AtUtils.query(subtext, flag);
                            caretOffset = Caret.getOffset(el);

                            if (scope.query === null) {
                                scope.isAtListHidden = true;
                            }

                            if (ng.isString(scope.query) && scope.query.length <= 10) {
                                if (scope.query === '' && el.next().attr('auto-follow') === 'true') {
                                    el.next().find('ul').css({
                                        left: caretOffset.left,
                                        top: caretOffset.top + lineHeight
                                    });
                                }
                                scope.query = {
                                    'text': scope.query,
                                    'headPos': nowCaretPos - scope.query.length,
                                    'endPos': nowCaretPos
                                };
                            }

                            if (ng.isObject(scope.query)) {
                                scope.users = scope.response;
                                scope.isAtListHidden = false;
                            }
                        }
                    }
                );

                el.bind('blur', function() {
                    scope.isAtListHidden = true;
                });

                el.bind('click touch keyup', function() {
                    scope.$apply(function() {
                        scope.caretPos = Caret.getPos(el);
                    });
                });
            };

            return new AtUser();
        }
    ]);

    at.directive('autoComplete', [
        'Caret', 'AtUtils',
        function(Caret, AtUtils) {
            function AutoComplete() {
                this.restrict = 'EA';
            }

            AutoComplete.prototype.link = function(scope, el) {
                var range;
                var span = el.next();
                var keyCode = {
                    up: 38,
                    down: 40,
                    enter: 13
                };

                scope.autoComplete = function(object) {
                    el[0].focus();
                    AtUtils.insert(el, scope.content, object.username, scope.query, range);
                    Caret.setPos(el, scope.query.headPos + object.username.length + 1);
                };

                span.bind('mouseenter', function() {
                    var lists = span.find('li');
                    range = AtUtils.markRange();
                    lists.removeClass('list-cur');
                });

                el.bind('keydown', function(e) {
                    var ul = el.next().find('ul');
                    var lists = ul.find('li');
                    var cur = ul.children('.list-cur');
                    if (scope.isAtListHidden === false) {
                        switch (e.keyCode) {
                            case keyCode.up:
                                e.originalEvent.preventDefault();
                                AtUtils.select.prev(cur, lists);
                                break;
                            case keyCode.down:
                                e.originalEvent.preventDefault();
                                AtUtils.select.next(cur, lists);
                                break;
                            case keyCode.enter:
                                e.originalEvent.preventDefault();
                                var insertContent = AtUtils.select.choose(cur);

                                scope.$apply(function() {
                                    range = AtUtils.markRange();
                                    AtUtils.insert(el, scope.content, insertContent, scope.query, range);
                                    scope.isAtListHidden = true;
                                });
                                Caret.setPos(el, scope.query.headPos + insertContent.length + 1);
                                break;
                        }
                    }
                });
            };

            return new AutoComplete();
        }
    ]);
})(angular, window, document);
