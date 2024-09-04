"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var React = _interopRequireWildcard(require("react"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _reactDom = _interopRequireDefault(require("react-dom"));
var _domFns = require("./utils/domFns");
var _positionFns = require("./utils/positionFns");
var _shims = require("./utils/shims");
var _log = _interopRequireDefault(require("./utils/log"));
var _lodash = require("lodash");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/*:: import type {EventHandler, MouseTouchEvent} from './utils/types';*/
/*:: import type {Element as ReactElement} from 'react';*/
// Simple abstraction for dragging events names.
const eventsFor = {
  touch: {
    start: 'touchstart',
    move: 'touchmove',
    stop: 'touchend'
  },
  mouse: {
    start: 'mousedown',
    move: 'mousemove',
    stop: 'mouseup'
  }
};

// Default to mouse events.
let dragEventFor = eventsFor.mouse;
/*:: export type DraggableData = {
  node: HTMLElement,
  x: number, y: number,
  deltaX: number, deltaY: number,
  lastX: number, lastY: number,
};*/
/*:: export type DraggableEventHandler = (e: MouseEvent, data: DraggableData) => void | false;*/
/*:: export type ControlPosition = {x: number, y: number};*/
/*:: export type PositionOffsetControlPosition = {x: number|string, y: number|string};*/
/*:: export type DraggableCoreDefaultProps = {
  allowAnyClick: boolean,
  allowMobileScroll: boolean,
  disabled: boolean,
  enableUserSelectHack: boolean,
  onStart: DraggableEventHandler,
  onDrag: DraggableEventHandler,
  onStop: DraggableEventHandler,
  onMouseDown: (e: MouseEvent) => void,
  scale: number,
  scrollValue: number,
  scrollThreshold: number,
  debounceScrollValue: number,
};*/
/*:: export type DraggableCoreProps = {
  ...DraggableCoreDefaultProps,
  cancel: string,
  children: ReactElement<any>,
  offsetParent: HTMLElement,
  grid: [number, number],
  handle: string,
  nodeRef?: ?React.ElementRef<any>,
};*/
//
// Define <DraggableCore>.
//
// <DraggableCore> is for advanced usage of <Draggable>. It maintains minimal internal state so it can
// work well with libraries that require more control over the element.
//

class DraggableCore extends React.Component /*:: <DraggableCoreProps>*/{
  constructor(props /*: DraggableCoreProps*/) {
    super(props);
    _defineProperty(this, "dragging", false);
    // Used while dragging to determine deltas.
    _defineProperty(this, "lastX", NaN);
    _defineProperty(this, "lastY", NaN);
    _defineProperty(this, "lastCursorPosX", NaN);
    _defineProperty(this, "lastCursorPosY", NaN);
    _defineProperty(this, "lastScrollX", NaN);
    _defineProperty(this, "lastScrollY", NaN);
    _defineProperty(this, "touchIdentifier", null);
    _defineProperty(this, "mounted", false);
    _defineProperty(this, "scrollIfNearBounds", void 0);
    _defineProperty(this, "handleDragStart", e => {
      // Make it possible to attach event handlers on top of this one.
      this.props.onMouseDown(e);

      // Only accept left-clicks.
      if (!this.props.allowAnyClick && typeof e.button === 'number' && e.button !== 0) return false;

      // Get nodes. Be sure to grab relative document (could be iframed)
      const thisNode = this.findDOMNode();
      if (!thisNode || !thisNode.ownerDocument || !thisNode.ownerDocument.body) {
        throw new Error('<DraggableCore> not mounted on DragStart!');
      }
      const {
        ownerDocument
      } = thisNode;

      // Short circuit if handle or cancel prop was provided and selector doesn't match.
      if (this.props.disabled || !(e.target instanceof ownerDocument.defaultView.Node) || this.props.handle && !(0, _domFns.matchesSelectorAndParentsTo)(e.target, this.props.handle, thisNode) || this.props.cancel && (0, _domFns.matchesSelectorAndParentsTo)(e.target, this.props.cancel, thisNode)) {
        return;
      }

      // Prevent scrolling on mobile devices, like ipad/iphone.
      // Important that this is after handle/cancel.
      if (e.type === 'touchstart' && !this.props.allowMobileScroll) e.preventDefault();

      // Set touch identifier in component state if this is a touch event. This allows us to
      // distinguish between individual touches on multitouch screens by identifying which
      // touchpoint was set to this element.
      const touchIdentifier = (0, _domFns.getTouchIdentifier)(e);
      this.touchIdentifier = touchIdentifier;

      // Get the current drag point from the event. This is used as the offset.
      const position = (0, _positionFns.getControlPosition)(e, touchIdentifier, this);
      if (position == null) return; // not possible but satisfies flow
      const {
        x,
        y
      } = position;

      // Create an event object with all the data parents need to make a decision here.
      const coreEvent = (0, _positionFns.createCoreData)(this, x, y);
      (0, _log.default)('DraggableCore: handleDragStart: %j', coreEvent);

      // Call event handler. If it returns explicit false, cancel.
      (0, _log.default)('calling', this.props.onStart);
      const shouldUpdate = this.props.onStart(e, coreEvent);
      if (shouldUpdate === false || this.mounted === false) return;

      // Add a style to the body to disable user-select. This prevents text from
      // being selected all over the page.
      if (this.props.enableUserSelectHack) (0, _domFns.addUserSelectStyles)(ownerDocument);

      // Initiate dragging. Set the current x and y as offsets
      // so we know how much we've moved during the drag. This allows us
      // to drag elements around even if they have been moved, without issue.
      this.dragging = true;
      this.lastX = x;
      this.lastY = y;
      this.lastScrollX = window.scrollX;
      this.lastScrollY = window.scrollY;

      // Add events to the document directly so we catch when the user's mouse/touch moves outside of
      // this element. We use different events depending on whether or not we have detected that this
      // is a touch-capable device.
      (0, _domFns.addEvent)(ownerDocument, dragEventFor.move, this.handleDrag);
      (0, _domFns.addEvent)(ownerDocument, dragEventFor.stop, this.handleDragStop);
      document.addEventListener('scroll', this.onScroll);
    });
    _defineProperty(this, "updateCursorPosition", e => {
      if (e.type === 'touchmove') {
        this.lastCursorPosX = e.touches[0].clientX;
        this.lastCursorPosY = e.touches[0].clientY;
      } else {
        this.lastCursorPosX = e.clientX;
        this.lastCursorPosY = e.clientY;
      }
    });
    _defineProperty(this, "handleDrag", e => {
      this.updateCursorPosition(e);
      // Get the current drag point from the event. This is used as the offset.
      const position = (0, _positionFns.getControlPosition)(e, this.touchIdentifier, this);
      if (position == null) return;
      let {
        x,
        y
      } = position;

      // Snap to grid if prop has been provided
      if (Array.isArray(this.props.grid)) {
        let deltaX = x - this.lastX,
          deltaY = y - this.lastY;
        [deltaX, deltaY] = (0, _positionFns.snapToGrid)(this.props.grid, deltaX, deltaY);
        if (!deltaX && !deltaY) return; // skip useless drag
        x = this.lastX + deltaX, y = this.lastY + deltaY;
      }
      const coreEvent = (0, _positionFns.createCoreData)(this, x, y);
      (0, _log.default)('DraggableCore: handleDrag: %j', coreEvent);

      // Call event handler. If it returns explicit false, trigger end.
      const shouldUpdate = this.props.onDrag(e, coreEvent);
      if (shouldUpdate === false || this.mounted === false) {
        try {
          // $FlowIgnore
          this.handleDragStop(new MouseEvent('mouseup'));
        } catch (err) {
          // Old browsers
          const event = ((document.createEvent('MouseEvents') /*: any*/) /*: MouseTouchEvent*/);
          // I see why this insanity was deprecated
          // $FlowIgnore
          event.initMouseEvent('mouseup', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
          this.handleDragStop(event);
        }
        return;
      }
      this.lastX = x;
      this.lastY = y;
      this.scrollIfNearBounds();
    });
    _defineProperty(this, "onScroll", (e /*: Event*/) => {
      const deltaScrollX = window.scrollX - this.lastScrollX;
      const deltaScrollY = window.scrollY - this.lastScrollY;
      const x = this.lastX + deltaScrollX;
      const y = this.lastY + deltaScrollY;
      const coreEvent = (0, _positionFns.createCoreData)(this, x, y);
      (0, _log.default)('DraggableCore: onScroll: %j', coreEvent);
      // $FlowIgnore`
      this.props.onDrag(e, coreEvent);
      this.lastX = x;
      this.lastY = y;
      this.lastScrollX = window.scrollX;
      this.lastScrollY = window.scrollY;
      this.scrollIfNearBounds();
    });
    _defineProperty(this, "handleDragStop", e => {
      if (!this.dragging) return;
      const position = (0, _positionFns.getControlPosition)(e, this.touchIdentifier, this);
      if (position == null) return;
      let {
        x,
        y
      } = position;

      // Snap to grid if prop has been provided
      if (Array.isArray(this.props.grid)) {
        let deltaX = x - this.lastX || 0;
        let deltaY = y - this.lastY || 0;
        [deltaX, deltaY] = (0, _positionFns.snapToGrid)(this.props.grid, deltaX, deltaY);
        x = this.lastX + deltaX, y = this.lastY + deltaY;
      }
      const coreEvent = (0, _positionFns.createCoreData)(this, x, y);

      // Call event handler
      const shouldContinue = this.props.onStop(e, coreEvent);
      if (shouldContinue === false || this.mounted === false) return false;
      const thisNode = this.findDOMNode();
      if (thisNode) {
        // Remove user-select hack
        if (this.props.enableUserSelectHack) (0, _domFns.removeUserSelectStyles)(thisNode.ownerDocument);
      }
      (0, _log.default)('DraggableCore: handleDragStop: %j', coreEvent);

      // Reset the el.
      this.dragging = false;
      this.lastX = NaN;
      this.lastY = NaN;
      this.lastScrollX = NaN;
      this.lastScrollY = NaN;
      if (thisNode) {
        // Remove event handlers
        (0, _log.default)('DraggableCore: Removing handlers');
        (0, _domFns.removeEvent)(thisNode.ownerDocument, dragEventFor.move, this.handleDrag);
        (0, _domFns.removeEvent)(thisNode.ownerDocument, dragEventFor.stop, this.handleDragStop);
      }
      document.removeEventListener('scroll', this.onScroll);
    });
    _defineProperty(this, "onMouseDown", e => {
      dragEventFor = eventsFor.mouse; // on touchscreen laptops we could switch back to mouse

      return this.handleDragStart(e);
    });
    _defineProperty(this, "onMouseUp", e => {
      dragEventFor = eventsFor.mouse;
      return this.handleDragStop(e);
    });
    // Same as onMouseDown (start drag), but now consider this a touch device.
    _defineProperty(this, "onTouchStart", e => {
      // We're on a touch device now, so change the event handlers
      dragEventFor = eventsFor.touch;
      return this.handleDragStart(e);
    });
    _defineProperty(this, "onTouchEnd", e => {
      // We're on a touch device now, so change the event handlers
      dragEventFor = eventsFor.touch;
      return this.handleDragStop(e);
    });
    this.scrollIfNearBounds = (0, _lodash.debounce)(() => {
      const {
        innerHeight: clientHeight
      } = window;
      if (clientHeight - this.lastCursorPosY <= this.props.scrollThreshold) {
        window.scrollBy({
          top: this.props.scrollValue,
          left: 0,
          behavior: 'instant'
        });
      } else if (this.lastCursorPosY <= this.props.scrollThreshold) {
        window.scrollBy({
          top: -this.props.scrollValue,
          left: 0,
          behavior: 'instant'
        });
      }
    }, this.props.debounceScrollValue);
  }
  componentDidMount() {
    this.mounted = true;
    // Touch handlers must be added with {passive: false} to be cancelable.
    // https://developers.google.com/web/updates/2017/01/scrolling-intervention
    const thisNode = this.findDOMNode();
    if (thisNode) {
      (0, _domFns.addEvent)(thisNode, eventsFor.touch.start, this.onTouchStart, {
        passive: false
      });
    }
  }
  componentWillUnmount() {
    this.mounted = false;
    // Remove any leftover event handlers. Remove both touch and mouse handlers in case
    // some browser quirk caused a touch event to fire during a mouse move, or vice versa.
    const thisNode = this.findDOMNode();
    if (thisNode) {
      const {
        ownerDocument
      } = thisNode;
      (0, _domFns.removeEvent)(ownerDocument, eventsFor.mouse.move, this.handleDrag);
      (0, _domFns.removeEvent)(ownerDocument, eventsFor.touch.move, this.handleDrag);
      (0, _domFns.removeEvent)(ownerDocument, eventsFor.mouse.stop, this.handleDragStop);
      (0, _domFns.removeEvent)(ownerDocument, eventsFor.touch.stop, this.handleDragStop);
      (0, _domFns.removeEvent)(thisNode, eventsFor.touch.start, this.onTouchStart, {
        passive: false
      });
      if (this.props.enableUserSelectHack) {
        // prevent a possible "forced reflow"
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(() => {
            (0, _domFns.removeUserSelectStyles)(ownerDocument);
          });
        } else {
          (0, _domFns.removeUserSelectStyles)(ownerDocument);
        }
      }
    }
  }

  // React Strict Mode compatibility: if `nodeRef` is passed, we will use it instead of trying to find
  // the underlying DOM node ourselves. See the README for more information.
  findDOMNode() /*: ?HTMLElement*/{
    return this.props?.nodeRef ? this.props?.nodeRef?.current : _reactDom.default.findDOMNode(this);
  }
  render() /*: React.Element<any>*/{
    // Reuse the child provided
    // This makes it flexible to use whatever element is wanted (div, ul, etc)
    return /*#__PURE__*/React.cloneElement(React.Children.only(this.props.children), {
      // Note: mouseMove handler is attached to document so it will still function
      // when the user drags quickly and leaves the bounds of the element.
      onMouseDown: this.onMouseDown,
      onMouseUp: this.onMouseUp,
      // onTouchStart is added on `componentDidMount` so they can be added with
      // {passive: false}, which allows it to cancel. See
      // https://developers.google.com/web/updates/2017/01/scrolling-intervention
      onTouchEnd: this.onTouchEnd
    });
  }
}
exports.default = DraggableCore;
_defineProperty(DraggableCore, "displayName", 'DraggableCore');
_defineProperty(DraggableCore, "propTypes", {
  /**
   * `allowAnyClick` allows dragging using any mouse button.
   * By default, we only accept the left button.
   *
   * Defaults to `false`.
   */
  allowAnyClick: _propTypes.default.bool,
  /**
   * `allowMobileScroll` turns off cancellation of the 'touchstart' event
   * on mobile devices. Only enable this if you are having trouble with click
   * events. Prefer using 'handle' / 'cancel' instead.
   *
   * Defaults to `false`.
   */
  allowMobileScroll: _propTypes.default.bool,
  children: _propTypes.default.node.isRequired,
  /**
   * `disabled`, if true, stops the <Draggable> from dragging. All handlers,
   * with the exception of `onMouseDown`, will not fire.
   */
  disabled: _propTypes.default.bool,
  /**
   * By default, we add 'user-select:none' attributes to the document body
   * to prevent ugly text selection during drag. If this is causing problems
   * for your app, set this to `false`.
   */
  enableUserSelectHack: _propTypes.default.bool,
  /**
   * `offsetParent`, if set, uses the passed DOM node to compute drag offsets
   * instead of using the parent node.
   */
  offsetParent: function (props /*: DraggableCoreProps*/, propName /*: $Keys<DraggableCoreProps>*/) {
    if (props[propName] && props[propName].nodeType !== 1) {
      throw new Error('Draggable\'s offsetParent must be a DOM Node.');
    }
  },
  /**
   * `grid` specifies the x and y that dragging should snap to.
   */
  grid: _propTypes.default.arrayOf(_propTypes.default.number),
  /**
   * `handle` specifies a selector to be used as the handle that initiates drag.
   *
   * Example:
   *
   * ```jsx
   *   let App = React.createClass({
   *       render: function () {
   *         return (
   *            <Draggable handle=".handle">
   *              <div>
   *                  <div className="handle">Click me to drag</div>
   *                  <div>This is some other content</div>
   *              </div>
   *           </Draggable>
   *         );
   *       }
   *   });
   * ```
   */
  handle: _propTypes.default.string,
  /**
   * `cancel` specifies a selector to be used to prevent drag initialization.
   *
   * Example:
   *
   * ```jsx
   *   let App = React.createClass({
   *       render: function () {
   *           return(
   *               <Draggable cancel=".cancel">
   *                   <div>
   *                     <div className="cancel">You can't drag from here</div>
   *                     <div>Dragging here works fine</div>
   *                   </div>
   *               </Draggable>
   *           );
   *       }
   *   });
   * ```
   */
  cancel: _propTypes.default.string,
  /* If running in React Strict mode, ReactDOM.findDOMNode() is deprecated.
   * Unfortunately, in order for <Draggable> to work properly, we need raw access
   * to the underlying DOM node. If you want to avoid the warning, pass a `nodeRef`
   * as in this example:
   *
   * function MyComponent() {
   *   const nodeRef = React.useRef(null);
   *   return (
   *     <Draggable nodeRef={nodeRef}>
   *       <div ref={nodeRef}>Example Target</div>
   *     </Draggable>
   *   );
   * }
   *
   * This can be used for arbitrarily nested components, so long as the ref ends up
   * pointing to the actual child DOM node and not a custom component.
   */
  nodeRef: _propTypes.default.object,
  /**
   * Called when dragging starts.
   * If this function returns the boolean false, dragging will be canceled.
   */
  onStart: _propTypes.default.func,
  /**
   * Called while dragging.
   * If this function returns the boolean false, dragging will be canceled.
   */
  onDrag: _propTypes.default.func,
  /**
   * Called when dragging stops.
   * If this function returns the boolean false, the drag will remain active.
   */
  onStop: _propTypes.default.func,
  /**
   * A workaround option which can be passed if onMouseDown needs to be accessed,
   * since it'll always be blocked (as there is internal use of onMouseDown)
   */
  onMouseDown: _propTypes.default.func,
  /**
   * `scale`, if set, applies scaling while dragging an element
   */
  scale: _propTypes.default.number,
  /**
   * These properties should be defined on the child, not here.
   */
  className: _shims.dontSetMe,
  style: _shims.dontSetMe,
  transform: _shims.dontSetMe
});
_defineProperty(DraggableCore, "defaultProps", {
  allowAnyClick: false,
  // by default only accept left click
  allowMobileScroll: false,
  disabled: false,
  enableUserSelectHack: true,
  onStart: function () {},
  onDrag: function () {},
  onStop: function () {},
  onMouseDown: function () {},
  scale: 1,
  scrollValue: 4,
  scrollThreshold: 50,
  debounceScrollValue: 1
});