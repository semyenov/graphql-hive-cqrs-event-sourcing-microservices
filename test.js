// node_modules/effect/dist/esm/Function.js
var isFunction = (input) => typeof input === "function";
var dual = function(arity, body) {
  if (typeof arity === "function") {
    return function() {
      if (arity(arguments)) {
        return body.apply(this, arguments);
      }
      return (self) => body(self, ...arguments);
    };
  }
  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`);
    case 2:
      return function(a, b) {
        if (arguments.length >= 2) {
          return body(a, b);
        }
        return function(self) {
          return body(self, a);
        };
      };
    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function(self) {
          return body(self, a, b);
        };
      };
    case 4:
      return function(a, b, c, d) {
        if (arguments.length >= 4) {
          return body(a, b, c, d);
        }
        return function(self) {
          return body(self, a, b, c);
        };
      };
    case 5:
      return function(a, b, c, d, e) {
        if (arguments.length >= 5) {
          return body(a, b, c, d, e);
        }
        return function(self) {
          return body(self, a, b, c, d);
        };
      };
    default:
      return function() {
        if (arguments.length >= arity) {
          return body.apply(this, arguments);
        }
        const args = arguments;
        return function(self) {
          return body(self, ...args);
        };
      };
  }
};
var identity = (a) => a;
var constant = (value) => () => value;
var constTrue = /* @__PURE__ */ constant(true);
var constFalse = /* @__PURE__ */ constant(false);
var constUndefined = /* @__PURE__ */ constant(undefined);
var constVoid = constUndefined;
function pipe(a, ab, bc, cd, de, ef, fg, gh, hi) {
  switch (arguments.length) {
    case 1:
      return a;
    case 2:
      return ab(a);
    case 3:
      return bc(ab(a));
    case 4:
      return cd(bc(ab(a)));
    case 5:
      return de(cd(bc(ab(a))));
    case 6:
      return ef(de(cd(bc(ab(a)))));
    case 7:
      return fg(ef(de(cd(bc(ab(a))))));
    case 8:
      return gh(fg(ef(de(cd(bc(ab(a)))))));
    case 9:
      return hi(gh(fg(ef(de(cd(bc(ab(a))))))));
    default: {
      let ret = arguments[0];
      for (let i = 1;i < arguments.length; i++) {
        ret = arguments[i](ret);
      }
      return ret;
    }
  }
}

// node_modules/effect/dist/esm/internal/version.js
var moduleVersion = "2.4.19";
var getCurrentVersion = () => moduleVersion;

// node_modules/effect/dist/esm/GlobalValue.js
var globalStoreId = /* @__PURE__ */ Symbol.for(`effect/GlobalValue/globalStoreId/${/* @__PURE__ */ getCurrentVersion()}`);
if (!(globalStoreId in globalThis)) {
  globalThis[globalStoreId] = /* @__PURE__ */ new Map;
}
var globalStore = globalThis[globalStoreId];
var globalValue = (id, compute) => {
  if (!globalStore.has(id)) {
    globalStore.set(id, compute());
  }
  return globalStore.get(id);
};

// node_modules/effect/dist/esm/Predicate.js
var isString = (input) => typeof input === "string";
var isNumber = (input) => typeof input === "number";
var isBigInt = (input) => typeof input === "bigint";
var isFunction2 = isFunction;
var isRecordOrArray = (input) => typeof input === "object" && input !== null;
var isObject = (input) => isRecordOrArray(input) || isFunction2(input);
var hasProperty = /* @__PURE__ */ dual(2, (self, property) => isObject(self) && (property in self));
var isTagged = /* @__PURE__ */ dual(2, (self, tag) => hasProperty(self, "_tag") && self["_tag"] === tag);
var isNullable = (input) => input === null || input === undefined;
var isIterable = (input) => hasProperty(input, Symbol.iterator);
var isPromiseLike = (input) => hasProperty(input, "then") && isFunction2(input.then);

// node_modules/effect/dist/esm/Utils.js
var defaultIncHi = 335903614;
var defaultIncLo = 4150755663;
var MUL_HI = 1481765933 >>> 0;
var MUL_LO = 1284865837 >>> 0;
var BIT_53 = 9007199254740992;
var BIT_27 = 134217728;

class PCGRandom {
  _state;
  constructor(seedHi, seedLo, incHi, incLo) {
    if (isNullable(seedLo) && isNullable(seedHi)) {
      seedLo = Math.random() * 4294967295 >>> 0;
      seedHi = 0;
    } else if (isNullable(seedLo)) {
      seedLo = seedHi;
      seedHi = 0;
    }
    if (isNullable(incLo) && isNullable(incHi)) {
      incLo = this._state ? this._state[3] : defaultIncLo;
      incHi = this._state ? this._state[2] : defaultIncHi;
    } else if (isNullable(incLo)) {
      incLo = incHi;
      incHi = 0;
    }
    this._state = new Int32Array([0, 0, incHi >>> 0, ((incLo || 0) | 1) >>> 0]);
    this._next();
    add64(this._state, this._state[0], this._state[1], seedHi >>> 0, seedLo >>> 0);
    this._next();
    return this;
  }
  getState() {
    return [this._state[0], this._state[1], this._state[2], this._state[3]];
  }
  setState(state) {
    this._state[0] = state[0];
    this._state[1] = state[1];
    this._state[2] = state[2];
    this._state[3] = state[3] | 1;
  }
  integer(max) {
    if (!max) {
      return this._next();
    }
    max = max >>> 0;
    if ((max & max - 1) === 0) {
      return this._next() & max - 1;
    }
    let num = 0;
    const skew = (-max >>> 0) % max >>> 0;
    for (num = this._next();num < skew; num = this._next()) {}
    return num % max;
  }
  number() {
    const hi = (this._next() & 67108863) * 1;
    const lo = (this._next() & 134217727) * 1;
    return (hi * BIT_27 + lo) / BIT_53;
  }
  _next() {
    const oldHi = this._state[0] >>> 0;
    const oldLo = this._state[1] >>> 0;
    mul64(this._state, oldHi, oldLo, MUL_HI, MUL_LO);
    add64(this._state, this._state[0], this._state[1], this._state[2], this._state[3]);
    let xsHi = oldHi >>> 18;
    let xsLo = (oldLo >>> 18 | oldHi << 14) >>> 0;
    xsHi = (xsHi ^ oldHi) >>> 0;
    xsLo = (xsLo ^ oldLo) >>> 0;
    const xorshifted = (xsLo >>> 27 | xsHi << 5) >>> 0;
    const rot = oldHi >>> 27;
    const rot2 = (-rot >>> 0 & 31) >>> 0;
    return (xorshifted >>> rot | xorshifted << rot2) >>> 0;
  }
}
function mul64(out, aHi, aLo, bHi, bLo) {
  let c1 = (aLo >>> 16) * (bLo & 65535) >>> 0;
  let c0 = (aLo & 65535) * (bLo >>> 16) >>> 0;
  let lo = (aLo & 65535) * (bLo & 65535) >>> 0;
  let hi = (aLo >>> 16) * (bLo >>> 16) + ((c0 >>> 16) + (c1 >>> 16)) >>> 0;
  c0 = c0 << 16 >>> 0;
  lo = lo + c0 >>> 0;
  if (lo >>> 0 < c0 >>> 0) {
    hi = hi + 1 >>> 0;
  }
  c1 = c1 << 16 >>> 0;
  lo = lo + c1 >>> 0;
  if (lo >>> 0 < c1 >>> 0) {
    hi = hi + 1 >>> 0;
  }
  hi = hi + Math.imul(aLo, bHi) >>> 0;
  hi = hi + Math.imul(aHi, bLo) >>> 0;
  out[0] = hi;
  out[1] = lo;
}
function add64(out, aHi, aLo, bHi, bLo) {
  let hi = aHi + bHi >>> 0;
  const lo = aLo + bLo >>> 0;
  if (lo >>> 0 < aLo >>> 0) {
    hi = hi + 1 | 0;
  }
  out[0] = hi;
  out[1] = lo;
}

// node_modules/effect/dist/esm/Hash.js
var randomHashCache = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/Hash/randomHashCache"), () => new WeakMap);
var pcgr = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/Hash/pcgr"), () => new PCGRandom);
var symbol = /* @__PURE__ */ Symbol.for("effect/Hash");
var hash = (self) => {
  switch (typeof self) {
    case "number":
      return number(self);
    case "bigint":
      return string(self.toString(10));
    case "boolean":
      return string(String(self));
    case "symbol":
      return string(String(self));
    case "string":
      return string(self);
    case "undefined":
      return string("undefined");
    case "function":
    case "object": {
      if (self === null) {
        return string("null");
      }
      if (isHash(self)) {
        return self[symbol]();
      } else {
        return random(self);
      }
    }
    default:
      throw new Error(`BUG: unhandled typeof ${typeof self} - please report an issue at https://github.com/Effect-TS/effect/issues`);
  }
};
var random = (self) => {
  if (!randomHashCache.has(self)) {
    randomHashCache.set(self, number(pcgr.integer(Number.MAX_SAFE_INTEGER)));
  }
  return randomHashCache.get(self);
};
var combine = (b) => (self) => self * 53 ^ b;
var optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
var isHash = (u) => hasProperty(u, symbol);
var number = (n) => {
  if (n !== n || n === Infinity) {
    return 0;
  }
  let h = n | 0;
  if (h !== n) {
    h ^= n * 4294967295;
  }
  while (n > 4294967295) {
    h ^= n /= 4294967295;
  }
  return optimize(n);
};
var string = (str) => {
  let h = 5381, i = str.length;
  while (i) {
    h = h * 33 ^ str.charCodeAt(--i);
  }
  return optimize(h);
};
var structureKeys = (o, keys) => {
  let h = 12289;
  for (let i = 0;i < keys.length; i++) {
    h ^= pipe(string(keys[i]), combine(hash(o[keys[i]])));
  }
  return optimize(h);
};
var structure = (o) => structureKeys(o, Object.keys(o));
var array = (arr) => {
  let h = 6151;
  for (let i = 0;i < arr.length; i++) {
    h = pipe(h, combine(hash(arr[i])));
  }
  return optimize(h);
};
var cached = function() {
  if (arguments.length === 1) {
    const self2 = arguments[0];
    return function(hash3) {
      Object.defineProperty(self2, symbol, {
        value() {
          return hash3;
        },
        enumerable: false
      });
      return hash3;
    };
  }
  const self = arguments[0];
  const hash2 = arguments[1];
  Object.defineProperty(self, symbol, {
    value() {
      return hash2;
    },
    enumerable: false
  });
  return hash2;
};

// node_modules/effect/dist/esm/Equal.js
var symbol2 = /* @__PURE__ */ Symbol.for("effect/Equal");
function equals() {
  if (arguments.length === 1) {
    return (self) => compareBoth(self, arguments[0]);
  }
  return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self, that) {
  if (self === that) {
    return true;
  }
  const selfType = typeof self;
  if (selfType !== typeof that) {
    return false;
  }
  if ((selfType === "object" || selfType === "function") && self !== null && that !== null) {
    if (isEqual(self) && isEqual(that)) {
      return hash(self) === hash(that) && self[symbol2](that);
    }
  }
  return false;
}
var isEqual = (u) => hasProperty(u, symbol2);
var equivalence = () => equals;

// node_modules/effect/dist/esm/Inspectable.js
var NodeInspectSymbol = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
var toJSON = (x) => {
  if (hasProperty(x, "toJSON") && isFunction2(x["toJSON"]) && x["toJSON"].length === 0) {
    return x.toJSON();
  } else if (Array.isArray(x)) {
    return x.map(toJSON);
  }
  return x;
};
var format = (x) => JSON.stringify(x, null, 2);
var BaseProto = {
  toJSON() {
    return toJSON(this);
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};
var toStringUnknown = (u, whitespace = 2) => {
  try {
    return typeof u === "object" ? stringifyCircular(u, whitespace) : String(u);
  } catch (_) {
    return String(u);
  }
};
var stringifyCircular = (obj, whitespace) => {
  let cache = [];
  const retVal = JSON.stringify(obj, (_key, value) => typeof value === "object" && value !== null ? cache.includes(value) ? undefined : cache.push(value) && value : value, whitespace);
  cache = undefined;
  return retVal;
};

// node_modules/effect/dist/esm/Pipeable.js
var pipeArguments = (self, args) => {
  switch (args.length) {
    case 1:
      return args[0](self);
    case 2:
      return args[1](args[0](self));
    case 3:
      return args[2](args[1](args[0](self)));
    case 4:
      return args[3](args[2](args[1](args[0](self))));
    case 5:
      return args[4](args[3](args[2](args[1](args[0](self)))));
    case 6:
      return args[5](args[4](args[3](args[2](args[1](args[0](self))))));
    case 7:
      return args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))));
    case 8:
      return args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self))))))));
    case 9:
      return args[8](args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))))));
    default: {
      let ret = self;
      for (let i = 0, len = args.length;i < len; i++) {
        ret = args[i](ret);
      }
      return ret;
    }
  }
};

// node_modules/effect/dist/esm/internal/opCodes/effect.js
var OP_ASYNC = "Async";
var OP_COMMIT = "Commit";
var OP_FAILURE = "Failure";
var OP_ON_FAILURE = "OnFailure";
var OP_ON_SUCCESS = "OnSuccess";
var OP_ON_SUCCESS_AND_FAILURE = "OnSuccessAndFailure";
var OP_SUCCESS = "Success";
var OP_SYNC = "Sync";
var OP_TAG = "Tag";
var OP_UPDATE_RUNTIME_FLAGS = "UpdateRuntimeFlags";
var OP_WHILE = "While";
var OP_WITH_RUNTIME = "WithRuntime";
var OP_YIELD = "Yield";
var OP_REVERT_FLAGS = "RevertFlags";

// node_modules/effect/dist/esm/internal/effectable.js
var EffectTypeId = /* @__PURE__ */ Symbol.for("effect/Effect");
var StreamTypeId = /* @__PURE__ */ Symbol.for("effect/Stream");
var SinkTypeId = /* @__PURE__ */ Symbol.for("effect/Sink");
var ChannelTypeId = /* @__PURE__ */ Symbol.for("effect/Channel");
var effectVariance = {
  _R: (_) => _,
  _E: (_) => _,
  _A: (_) => _,
  _V: /* @__PURE__ */ getCurrentVersion()
};
var sinkVariance = {
  _A: (_) => _,
  _In: (_) => _,
  _L: (_) => _,
  _E: (_) => _,
  _R: (_) => _
};
var channelVariance = {
  _Env: (_) => _,
  _InErr: (_) => _,
  _InElem: (_) => _,
  _InDone: (_) => _,
  _OutErr: (_) => _,
  _OutElem: (_) => _,
  _OutDone: (_) => _
};
var EffectPrototype = {
  [EffectTypeId]: effectVariance,
  [StreamTypeId]: effectVariance,
  [SinkTypeId]: sinkVariance,
  [ChannelTypeId]: channelVariance,
  [symbol2](that) {
    return this === that;
  },
  [symbol]() {
    return cached(this, random(this));
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var StructuralPrototype = {
  [symbol]() {
    return cached(this, structure(this));
  },
  [symbol2](that) {
    const selfKeys = Object.keys(this);
    const thatKeys = Object.keys(that);
    if (selfKeys.length !== thatKeys.length) {
      return false;
    }
    for (const key of selfKeys) {
      if (!((key in that) && equals(this[key], that[key]))) {
        return false;
      }
    }
    return true;
  }
};
var CommitPrototype = {
  ...EffectPrototype,
  _op: OP_COMMIT
};
var StructuralCommitPrototype = {
  ...CommitPrototype,
  ...StructuralPrototype
};

// node_modules/effect/dist/esm/internal/option.js
var TypeId = /* @__PURE__ */ Symbol.for("effect/Option");
var CommonProto = {
  ...EffectPrototype,
  [TypeId]: {
    _A: (_) => _
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};
var SomeProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "Some",
  _op: "Some",
  [symbol2](that) {
    return isOption(that) && isSome(that) && equals(that.value, this.value);
  },
  [symbol]() {
    return cached(this, combine(hash(this._tag))(hash(this.value)));
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJSON(this.value)
    };
  }
});
var NoneHash = /* @__PURE__ */ hash("None");
var NoneProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "None",
  _op: "None",
  [symbol2](that) {
    return isOption(that) && isNone(that);
  },
  [symbol]() {
    return NoneHash;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag
    };
  }
});
var isOption = (input) => hasProperty(input, TypeId);
var isNone = (fa) => fa._tag === "None";
var isSome = (fa) => fa._tag === "Some";
var none = /* @__PURE__ */ Object.create(NoneProto);
var some = (value) => {
  const a = Object.create(SomeProto);
  a.value = value;
  return a;
};

// node_modules/effect/dist/esm/internal/context.js
var TagTypeId = /* @__PURE__ */ Symbol.for("effect/Context/Tag");
var STMSymbolKey = "effect/STM";
var STMTypeId = /* @__PURE__ */ Symbol.for(STMSymbolKey);
var TagProto = {
  ...EffectPrototype,
  _tag: "Tag",
  _op: "Tag",
  [STMTypeId]: effectVariance,
  [TagTypeId]: {
    _Service: (_) => _,
    _Identifier: (_) => _
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "Tag",
      key: this.key,
      stack: this.stack
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  of(self) {
    return self;
  },
  context(self) {
    return make(this, self);
  }
};
var makeGenericTag = (key) => {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 2;
  const creationError = new Error;
  Error.stackTraceLimit = limit;
  const tag = Object.create(TagProto);
  Object.defineProperty(tag, "stack", {
    get() {
      return creationError.stack;
    }
  });
  tag.key = key;
  return tag;
};
var TypeId2 = /* @__PURE__ */ Symbol.for("effect/Context");
var ContextProto = {
  [TypeId2]: {
    _Services: (_) => _
  },
  [symbol2](that) {
    if (isContext(that)) {
      if (this.unsafeMap.size === that.unsafeMap.size) {
        for (const k of this.unsafeMap.keys()) {
          if (!that.unsafeMap.has(k) || !equals(this.unsafeMap.get(k), that.unsafeMap.get(k))) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  },
  [symbol]() {
    return cached(this, number(this.unsafeMap.size));
  },
  pipe() {
    return pipeArguments(this, arguments);
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "Context",
      services: Array.from(this.unsafeMap).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
};
var makeContext = (unsafeMap) => {
  const context = Object.create(ContextProto);
  context.unsafeMap = unsafeMap;
  return context;
};
var serviceNotFoundError = (tag) => {
  const error = new Error(`Service not found${tag.key ? `: ${String(tag.key)}` : ""}`);
  if (tag.stack) {
    const lines = tag.stack.split(`
`);
    if (lines.length > 2) {
      const afterAt = lines[2].match(/at (.*)/);
      if (afterAt) {
        error.message = error.message + ` (defined at ${afterAt[1]})`;
      }
    }
  }
  if (error.stack) {
    const lines = error.stack.split(`
`);
    lines.splice(1, 3);
    error.stack = lines.join(`
`);
  }
  return error;
};
var isContext = (u) => hasProperty(u, TypeId2);
var isTag = (u) => hasProperty(u, TagTypeId);
var _empty = /* @__PURE__ */ makeContext(/* @__PURE__ */ new Map);
var empty = () => _empty;
var make = (tag, service) => makeContext(new Map([[tag.key, service]]));
var add = /* @__PURE__ */ dual(3, (self, tag, service) => {
  const map = new Map(self.unsafeMap);
  map.set(tag.key, service);
  return makeContext(map);
});
var unsafeGet = /* @__PURE__ */ dual(2, (self, tag) => {
  if (!self.unsafeMap.has(tag.key)) {
    throw serviceNotFoundError(tag);
  }
  return self.unsafeMap.get(tag.key);
});
var get = unsafeGet;
var getOption = /* @__PURE__ */ dual(2, (self, tag) => {
  if (!self.unsafeMap.has(tag.key)) {
    return none;
  }
  return some(self.unsafeMap.get(tag.key));
});
var merge = /* @__PURE__ */ dual(2, (self, that) => {
  const map = new Map(self.unsafeMap);
  for (const [tag, s] of that.unsafeMap) {
    map.set(tag, s);
  }
  return makeContext(map);
});

// node_modules/effect/dist/esm/Context.js
var GenericTag = makeGenericTag;
var isContext2 = isContext;
var isTag2 = isTag;
var empty2 = empty;
var make2 = make;
var add2 = add;
var get2 = get;
var unsafeGet2 = unsafeGet;
var getOption2 = getOption;
var merge2 = merge;

// node_modules/effect/dist/esm/Equivalence.js
var make3 = (isEquivalent) => (self, that) => self === that || isEquivalent(self, that);
var isStrictEquivalent = (x, y) => x === y;
var strict = () => isStrictEquivalent;
var number2 = /* @__PURE__ */ strict();
var mapInput = /* @__PURE__ */ dual(2, (self, f) => make3((x, y) => self(f(x), f(y))));
var array2 = (item) => make3((self, that) => {
  if (self.length !== that.length) {
    return false;
  }
  for (let i = 0;i < self.length; i++) {
    const isEq = item(self[i], that[i]);
    if (!isEq) {
      return false;
    }
  }
  return true;
});

// node_modules/effect/dist/esm/internal/either.js
var TypeId3 = /* @__PURE__ */ Symbol.for("effect/Either");
var CommonProto2 = {
  ...EffectPrototype,
  [TypeId3]: {
    _R: (_) => _
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};
var RightProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Right",
  _op: "Right",
  [symbol2](that) {
    return isEither(that) && isRight(that) && equals(that.right, this.right);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.right));
  },
  toJSON() {
    return {
      _id: "Either",
      _tag: this._tag,
      right: toJSON(this.right)
    };
  }
});
var LeftProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Left",
  _op: "Left",
  [symbol2](that) {
    return isEither(that) && isLeft(that) && equals(that.left, this.left);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.left));
  },
  toJSON() {
    return {
      _id: "Either",
      _tag: this._tag,
      left: toJSON(this.left)
    };
  }
});
var isEither = (input) => hasProperty(input, TypeId3);
var isLeft = (ma) => ma._tag === "Left";
var isRight = (ma) => ma._tag === "Right";
var left = (left2) => {
  const a = Object.create(LeftProto);
  a.left = left2;
  return a;
};
var right = (right2) => {
  const a = Object.create(RightProto);
  a.right = right2;
  return a;
};
var fromOption = /* @__PURE__ */ dual(2, (self, onNone) => isNone(self) ? left(onNone()) : right(self.value));

// node_modules/effect/dist/esm/Order.js
var make4 = (compare) => (self, that) => self === that ? 0 : compare(self, that);
var number3 = /* @__PURE__ */ make4((self, that) => self < that ? -1 : 1);
var mapInput2 = /* @__PURE__ */ dual(2, (self, f) => make4((b1, b2) => self(f(b1), f(b2))));
var greaterThan = (O) => dual(2, (self, that) => O(self, that) === 1);

// node_modules/effect/dist/esm/Option.js
var none2 = () => none;
var some2 = some;
var isNone2 = isNone;
var isSome2 = isSome;
var match = /* @__PURE__ */ dual(2, (self, {
  onNone,
  onSome
}) => isNone2(self) ? onNone() : onSome(self.value));
var getOrElse = /* @__PURE__ */ dual(2, (self, onNone) => isNone2(self) ? onNone() : self.value);
var orElseSome = /* @__PURE__ */ dual(2, (self, onNone) => isNone2(self) ? some2(onNone()) : self);
var fromNullable = (nullableValue) => nullableValue == null ? none2() : some2(nullableValue);
var getOrUndefined = /* @__PURE__ */ getOrElse(constUndefined);
var liftThrowable = (f) => (...a) => {
  try {
    return some2(f(...a));
  } catch (e) {
    return none2();
  }
};
var getOrThrowWith = /* @__PURE__ */ dual(2, (self, onNone) => {
  if (isSome2(self)) {
    return self.value;
  }
  throw onNone();
});
var getOrThrow = /* @__PURE__ */ getOrThrowWith(() => new Error("getOrThrow called on a None"));
var map = /* @__PURE__ */ dual(2, (self, f) => isNone2(self) ? none2() : some2(f(self.value)));
var flatMap = /* @__PURE__ */ dual(2, (self, f) => isNone2(self) ? none2() : f(self.value));
var liftPredicate = (predicate) => (b) => predicate(b) ? some2(b) : none2();
var containsWith = (isEquivalent) => dual(2, (self, a) => isNone2(self) ? false : isEquivalent(self.value, a));
var _equivalence = /* @__PURE__ */ equivalence();
var contains = /* @__PURE__ */ containsWith(_equivalence);

// node_modules/effect/dist/esm/Either.js
var right2 = right;
var left2 = left;
var fromOption2 = fromOption;
var isLeft2 = isLeft;
var isRight2 = isRight;
var match2 = /* @__PURE__ */ dual(2, (self, {
  onLeft,
  onRight
}) => isLeft2(self) ? onLeft(self.left) : onRight(self.right));
var merge3 = /* @__PURE__ */ match2({
  onLeft: identity,
  onRight: identity
});

// node_modules/effect/dist/esm/internal/readonlyArray.js
var isNonEmptyArray = (self) => self.length > 0;

// node_modules/effect/dist/esm/Tuple.js
var make5 = (...elements) => elements;

// node_modules/effect/dist/esm/Iterable.js
var constEmpty = {
  [Symbol.iterator]() {
    return constEmptyIterator;
  }
};
var constEmptyIterator = {
  next() {
    return {
      done: true,
      value: undefined
    };
  }
};

// node_modules/effect/dist/esm/ReadonlyArray.js
var makeBy = (n, f) => {
  const max2 = Math.max(1, Math.floor(n));
  const out = [f(0)];
  for (let i = 1;i < max2; i++) {
    out.push(f(i));
  }
  return out;
};
var fromIterable = (collection) => Array.isArray(collection) ? collection : Array.from(collection);
var prepend = /* @__PURE__ */ dual(2, (self, head) => [head, ...self]);
var append = /* @__PURE__ */ dual(2, (self, last) => [...self, last]);
var appendAll = /* @__PURE__ */ dual(2, (self, that) => fromIterable(self).concat(fromIterable(that)));
var isEmptyArray = (self) => self.length === 0;
var isEmptyReadonlyArray = isEmptyArray;
var isNonEmptyArray2 = isNonEmptyArray;
var isNonEmptyReadonlyArray = isNonEmptyArray;
var isOutOfBound = (i, as) => i < 0 || i >= as.length;
var clamp = (i, as) => Math.floor(Math.min(Math.max(0, i), as.length));
var get3 = /* @__PURE__ */ dual(2, (self, index) => {
  const i = Math.floor(index);
  return isOutOfBound(i, self) ? none2() : some2(self[i]);
});
var unsafeGet3 = /* @__PURE__ */ dual(2, (self, index) => {
  const i = Math.floor(index);
  if (isOutOfBound(i, self)) {
    throw new Error(`Index ${i} out of bounds`);
  }
  return self[i];
});
var head = /* @__PURE__ */ get3(0);
var headNonEmpty = /* @__PURE__ */ unsafeGet3(0);
var last = (self) => isNonEmptyReadonlyArray(self) ? some2(lastNonEmpty(self)) : none2();
var lastNonEmpty = (self) => self[self.length - 1];
var tailNonEmpty = (self) => self.slice(1);
var spanIndex = (self, predicate) => {
  let i = 0;
  for (const a of self) {
    if (!predicate(a, i)) {
      break;
    }
    i++;
  }
  return i;
};
var span = /* @__PURE__ */ dual(2, (self, predicate) => splitAt(self, spanIndex(self, predicate)));
var drop = /* @__PURE__ */ dual(2, (self, n) => {
  const input = fromIterable(self);
  return input.slice(clamp(n, input), input.length);
});
var reverse = (self) => Array.from(self).reverse();
var sort = /* @__PURE__ */ dual(2, (self, O) => {
  const out = Array.from(self);
  out.sort(O);
  return out;
});
var zip = /* @__PURE__ */ dual(2, (self, that) => zipWith(self, that, make5));
var zipWith = /* @__PURE__ */ dual(3, (self, that, f) => {
  const as = fromIterable(self);
  const bs = fromIterable(that);
  if (isNonEmptyReadonlyArray(as) && isNonEmptyReadonlyArray(bs)) {
    const out = [f(headNonEmpty(as), headNonEmpty(bs))];
    const len = Math.min(as.length, bs.length);
    for (let i = 1;i < len; i++) {
      out[i] = f(as[i], bs[i]);
    }
    return out;
  }
  return [];
});
var _equivalence2 = /* @__PURE__ */ equivalence();
var splitAt = /* @__PURE__ */ dual(2, (self, n) => {
  const input = Array.from(self);
  const _n = Math.floor(n);
  if (isNonEmptyReadonlyArray(input)) {
    if (_n >= 1) {
      return splitNonEmptyAt(input, _n);
    }
    return [[], input];
  }
  return [input, []];
});
var splitNonEmptyAt = /* @__PURE__ */ dual(2, (self, n) => {
  const _n = Math.max(1, Math.floor(n));
  return _n >= self.length ? [copy(self), []] : [prepend(self.slice(1, _n), headNonEmpty(self)), self.slice(_n)];
});
var copy = (self) => self.slice();
var unionWith = /* @__PURE__ */ dual(3, (self, that, isEquivalent) => {
  const a = fromIterable(self);
  const b = fromIterable(that);
  if (isNonEmptyReadonlyArray(a)) {
    if (isNonEmptyReadonlyArray(b)) {
      const dedupe = dedupeWith(isEquivalent);
      return dedupe(appendAll(a, b));
    }
    return a;
  }
  return b;
});
var union = /* @__PURE__ */ dual(2, (self, that) => unionWith(self, that, _equivalence2));
var empty3 = () => [];
var of = (a) => [a];
var map2 = /* @__PURE__ */ dual(2, (self, f) => self.map(f));
var flatMap2 = /* @__PURE__ */ dual(2, (self, f) => {
  if (isEmptyReadonlyArray(self)) {
    return [];
  }
  const out = [];
  for (let i = 0;i < self.length; i++) {
    const inner = f(self[i], i);
    for (let j = 0;j < inner.length; j++) {
      out.push(inner[j]);
    }
  }
  return out;
});
var flatten = /* @__PURE__ */ flatMap2(identity);
var filterMap = /* @__PURE__ */ dual(2, (self, f) => {
  const as = fromIterable(self);
  const out = [];
  for (let i = 0;i < as.length; i++) {
    const o = f(as[i], i);
    if (isSome2(o)) {
      out.push(o.value);
    }
  }
  return out;
});
var reduce = /* @__PURE__ */ dual(3, (self, b, f) => fromIterable(self).reduce((b2, a, i) => f(b2, a, i), b));
var unfold = (b, f) => {
  const out = [];
  let next = b;
  let o;
  while (isSome2(o = f(next))) {
    const [a, b2] = o.value;
    out.push(a);
    next = b2;
  }
  return out;
};
var getEquivalence = array2;
var dedupeWith = /* @__PURE__ */ dual(2, (self, isEquivalent) => {
  const input = fromIterable(self);
  if (isNonEmptyReadonlyArray(input)) {
    const out = [headNonEmpty(input)];
    const rest = tailNonEmpty(input);
    for (const r of rest) {
      if (out.every((a) => !isEquivalent(r, a))) {
        out.push(r);
      }
    }
    return out;
  }
  return [];
});
var dedupe = (self) => dedupeWith(self, equivalence());
var join = /* @__PURE__ */ dual(2, (self, sep) => fromIterable(self).join(sep));

// node_modules/effect/dist/esm/Chunk.js
var TypeId4 = /* @__PURE__ */ Symbol.for("effect/Chunk");
function copy2(src, srcPos, dest, destPos, len) {
  for (let i = srcPos;i < Math.min(src.length, srcPos + len); i++) {
    dest[destPos + i - srcPos] = src[i];
  }
  return dest;
}
var emptyArray = [];
var getEquivalence2 = (isEquivalent) => make3((self, that) => self.length === that.length && toReadonlyArray(self).every((value, i) => isEquivalent(value, unsafeGet4(that, i))));
var _equivalence3 = /* @__PURE__ */ getEquivalence2(equals);
var ChunkProto = {
  [TypeId4]: {
    _A: (_) => _
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "Chunk",
      values: toReadonlyArray(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  [symbol2](that) {
    return isChunk(that) && _equivalence3(this, that);
  },
  [symbol]() {
    return cached(this, array(toReadonlyArray(this)));
  },
  [Symbol.iterator]() {
    switch (this.backing._tag) {
      case "IArray": {
        return this.backing.array[Symbol.iterator]();
      }
      case "IEmpty": {
        return emptyArray[Symbol.iterator]();
      }
      default: {
        return toReadonlyArray(this)[Symbol.iterator]();
      }
    }
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeChunk = (backing) => {
  const chunk = Object.create(ChunkProto);
  chunk.backing = backing;
  switch (backing._tag) {
    case "IEmpty": {
      chunk.length = 0;
      chunk.depth = 0;
      chunk.left = chunk;
      chunk.right = chunk;
      break;
    }
    case "IConcat": {
      chunk.length = backing.left.length + backing.right.length;
      chunk.depth = 1 + Math.max(backing.left.depth, backing.right.depth);
      chunk.left = backing.left;
      chunk.right = backing.right;
      break;
    }
    case "IArray": {
      chunk.length = backing.array.length;
      chunk.depth = 0;
      chunk.left = _empty2;
      chunk.right = _empty2;
      break;
    }
    case "ISingleton": {
      chunk.length = 1;
      chunk.depth = 0;
      chunk.left = _empty2;
      chunk.right = _empty2;
      break;
    }
    case "ISlice": {
      chunk.length = backing.length;
      chunk.depth = backing.chunk.depth + 1;
      chunk.left = _empty2;
      chunk.right = _empty2;
      break;
    }
  }
  return chunk;
};
var isChunk = (u) => hasProperty(u, TypeId4);
var _empty2 = /* @__PURE__ */ makeChunk({
  _tag: "IEmpty"
});
var empty4 = () => _empty2;
var of2 = (a) => makeChunk({
  _tag: "ISingleton",
  a
});
var fromIterable2 = (self) => isChunk(self) ? self : makeChunk({
  _tag: "IArray",
  array: fromIterable(self)
});
var copyToArray = (self, array4, initial) => {
  switch (self.backing._tag) {
    case "IArray": {
      copy2(self.backing.array, 0, array4, initial, self.length);
      break;
    }
    case "IConcat": {
      copyToArray(self.left, array4, initial);
      copyToArray(self.right, array4, initial + self.left.length);
      break;
    }
    case "ISingleton": {
      array4[initial] = self.backing.a;
      break;
    }
    case "ISlice": {
      let i = 0;
      let j = initial;
      while (i < self.length) {
        array4[j] = unsafeGet4(self, i);
        i += 1;
        j += 1;
      }
      break;
    }
  }
};
var toReadonlyArray = (self) => {
  switch (self.backing._tag) {
    case "IEmpty": {
      return emptyArray;
    }
    case "IArray": {
      return self.backing.array;
    }
    default: {
      const arr = new Array(self.length);
      copyToArray(self, arr, 0);
      self.backing = {
        _tag: "IArray",
        array: arr
      };
      self.left = _empty2;
      self.right = _empty2;
      self.depth = 0;
      return arr;
    }
  }
};
var reverse2 = (self) => {
  switch (self.backing._tag) {
    case "IEmpty":
    case "ISingleton":
      return self;
    case "IArray": {
      return makeChunk({
        _tag: "IArray",
        array: reverse(self.backing.array)
      });
    }
    case "IConcat": {
      return makeChunk({
        _tag: "IConcat",
        left: reverse2(self.backing.right),
        right: reverse2(self.backing.left)
      });
    }
    case "ISlice":
      return unsafeFromArray(reverse(toReadonlyArray(self)));
  }
};
var get4 = /* @__PURE__ */ dual(2, (self, index) => index < 0 || index >= self.length ? none2() : some2(unsafeGet4(self, index)));
var unsafeFromArray = (self) => makeChunk({
  _tag: "IArray",
  array: self
});
var unsafeGet4 = /* @__PURE__ */ dual(2, (self, index) => {
  switch (self.backing._tag) {
    case "IEmpty": {
      throw new Error(`Index out of bounds`);
    }
    case "ISingleton": {
      if (index !== 0) {
        throw new Error(`Index out of bounds`);
      }
      return self.backing.a;
    }
    case "IArray": {
      if (index >= self.length || index < 0) {
        throw new Error(`Index out of bounds`);
      }
      return self.backing.array[index];
    }
    case "IConcat": {
      return index < self.left.length ? unsafeGet4(self.left, index) : unsafeGet4(self.right, index - self.left.length);
    }
    case "ISlice": {
      return unsafeGet4(self.backing.chunk, index + self.backing.offset);
    }
  }
});
var append2 = /* @__PURE__ */ dual(2, (self, a) => appendAll2(self, of2(a)));
var prepend2 = /* @__PURE__ */ dual(2, (self, elem) => appendAll2(of2(elem), self));
var take = /* @__PURE__ */ dual(2, (self, n) => {
  if (n <= 0) {
    return _empty2;
  } else if (n >= self.length) {
    return self;
  } else {
    switch (self.backing._tag) {
      case "ISlice": {
        return makeChunk({
          _tag: "ISlice",
          chunk: self.backing.chunk,
          length: n,
          offset: self.backing.offset
        });
      }
      case "IConcat": {
        if (n > self.left.length) {
          return makeChunk({
            _tag: "IConcat",
            left: self.left,
            right: take(self.right, n - self.left.length)
          });
        }
        return take(self.left, n);
      }
      default: {
        return makeChunk({
          _tag: "ISlice",
          chunk: self,
          offset: 0,
          length: n
        });
      }
    }
  }
});
var drop2 = /* @__PURE__ */ dual(2, (self, n) => {
  if (n <= 0) {
    return self;
  } else if (n >= self.length) {
    return _empty2;
  } else {
    switch (self.backing._tag) {
      case "ISlice": {
        return makeChunk({
          _tag: "ISlice",
          chunk: self.backing.chunk,
          offset: self.backing.offset + n,
          length: self.backing.length - n
        });
      }
      case "IConcat": {
        if (n > self.left.length) {
          return drop2(self.right, n - self.left.length);
        }
        return makeChunk({
          _tag: "IConcat",
          left: drop2(self.left, n),
          right: self.right
        });
      }
      default: {
        return makeChunk({
          _tag: "ISlice",
          chunk: self,
          offset: n,
          length: self.length - n
        });
      }
    }
  }
});
var appendAll2 = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.backing._tag === "IEmpty") {
    return that;
  }
  if (that.backing._tag === "IEmpty") {
    return self;
  }
  const diff = that.depth - self.depth;
  if (Math.abs(diff) <= 1) {
    return makeChunk({
      _tag: "IConcat",
      left: self,
      right: that
    });
  } else if (diff < -1) {
    if (self.left.depth >= self.right.depth) {
      const nr = appendAll2(self.right, that);
      return makeChunk({
        _tag: "IConcat",
        left: self.left,
        right: nr
      });
    } else {
      const nrr = appendAll2(self.right.right, that);
      if (nrr.depth === self.depth - 3) {
        const nr = makeChunk({
          _tag: "IConcat",
          left: self.right.left,
          right: nrr
        });
        return makeChunk({
          _tag: "IConcat",
          left: self.left,
          right: nr
        });
      } else {
        const nl = makeChunk({
          _tag: "IConcat",
          left: self.left,
          right: self.right.left
        });
        return makeChunk({
          _tag: "IConcat",
          left: nl,
          right: nrr
        });
      }
    }
  } else {
    if (that.right.depth >= that.left.depth) {
      const nl = appendAll2(self, that.left);
      return makeChunk({
        _tag: "IConcat",
        left: nl,
        right: that.right
      });
    } else {
      const nll = appendAll2(self, that.left.left);
      if (nll.depth === that.depth - 3) {
        const nl = makeChunk({
          _tag: "IConcat",
          left: nll,
          right: that.left.right
        });
        return makeChunk({
          _tag: "IConcat",
          left: nl,
          right: that.right
        });
      } else {
        const nr = makeChunk({
          _tag: "IConcat",
          left: that.left.right,
          right: that.right
        });
        return makeChunk({
          _tag: "IConcat",
          left: nll,
          right: nr
        });
      }
    }
  }
});
var filterMap2 = /* @__PURE__ */ dual(2, (self, f) => unsafeFromArray(filterMap(self, f)));
var filter = /* @__PURE__ */ dual(2, (self, predicate) => unsafeFromArray(filterMap(self, liftPredicate(predicate))));
var isEmpty = (self) => self.length === 0;
var isNonEmpty = (self) => self.length > 0;
var head2 = /* @__PURE__ */ get4(0);
var unsafeHead = (self) => unsafeGet4(self, 0);
var headNonEmpty2 = unsafeHead;
var map3 = /* @__PURE__ */ dual(2, (self, f) => self.backing._tag === "ISingleton" ? of2(f(self.backing.a, 0)) : unsafeFromArray(pipe(toReadonlyArray(self), map2((a, i) => f(a, i)))));
var splitAt2 = /* @__PURE__ */ dual(2, (self, n) => [take(self, n), drop2(self, n)]);
var splitWhere = /* @__PURE__ */ dual(2, (self, predicate) => {
  let i = 0;
  for (const a of toReadonlyArray(self)) {
    if (predicate(a)) {
      break;
    } else {
      i++;
    }
  }
  return splitAt2(self, i);
});
var tailNonEmpty2 = (self) => drop2(self, 1);
var reduce2 = reduce;

// node_modules/effect/dist/esm/internal/hashMap/config.js
var SIZE = 5;
var BUCKET_SIZE = /* @__PURE__ */ Math.pow(2, SIZE);
var MASK = BUCKET_SIZE - 1;
var MAX_INDEX_NODE = BUCKET_SIZE / 2;
var MIN_ARRAY_NODE = BUCKET_SIZE / 4;

// node_modules/effect/dist/esm/internal/hashMap/bitwise.js
function popcount(x) {
  x -= x >> 1 & 1431655765;
  x = (x & 858993459) + (x >> 2 & 858993459);
  x = x + (x >> 4) & 252645135;
  x += x >> 8;
  x += x >> 16;
  return x & 127;
}
function hashFragment(shift, h) {
  return h >>> shift & MASK;
}
function toBitmap(x) {
  return 1 << x;
}
function fromBitmap(bitmap, bit) {
  return popcount(bitmap & bit - 1);
}

// node_modules/effect/dist/esm/internal/stack.js
var make6 = (value, previous) => ({
  value,
  previous
});

// node_modules/effect/dist/esm/internal/hashMap/array.js
function arrayUpdate(mutate, at, v, arr) {
  let out = arr;
  if (!mutate) {
    const len = arr.length;
    out = new Array(len);
    for (let i = 0;i < len; ++i)
      out[i] = arr[i];
  }
  out[at] = v;
  return out;
}
function arraySpliceOut(mutate, at, arr) {
  const newLen = arr.length - 1;
  let i = 0;
  let g = 0;
  let out = arr;
  if (mutate) {
    i = g = at;
  } else {
    out = new Array(newLen);
    while (i < at)
      out[g++] = arr[i++];
  }
  ++i;
  while (i <= newLen)
    out[g++] = arr[i++];
  if (mutate) {
    out.length = newLen;
  }
  return out;
}
function arraySpliceIn(mutate, at, v, arr) {
  const len = arr.length;
  if (mutate) {
    let i2 = len;
    while (i2 >= at)
      arr[i2--] = arr[i2];
    arr[at] = v;
    return arr;
  }
  let i = 0, g = 0;
  const out = new Array(len + 1);
  while (i < at)
    out[g++] = arr[i++];
  out[at] = v;
  while (i < len)
    out[++g] = arr[i++];
  return out;
}

// node_modules/effect/dist/esm/internal/hashMap/node.js
class EmptyNode {
  _tag = "EmptyNode";
  modify(edit, _shift, f, hash2, key, size) {
    const v = f(none2());
    if (isNone2(v))
      return new EmptyNode;
    ++size.value;
    return new LeafNode(edit, hash2, key, v);
  }
}
function isEmptyNode(a) {
  return isTagged(a, "EmptyNode");
}
function isLeafNode(node) {
  return isEmptyNode(node) || node._tag === "LeafNode" || node._tag === "CollisionNode";
}
function canEditNode(node, edit) {
  return isEmptyNode(node) ? false : edit === node.edit;
}

class LeafNode {
  edit;
  hash;
  key;
  value;
  _tag = "LeafNode";
  constructor(edit, hash2, key, value) {
    this.edit = edit;
    this.hash = hash2;
    this.key = key;
    this.value = value;
  }
  modify(edit, shift, f, hash2, key, size) {
    if (equals(key, this.key)) {
      const v2 = f(this.value);
      if (v2 === this.value)
        return this;
      else if (isNone2(v2)) {
        --size.value;
        return new EmptyNode;
      }
      if (canEditNode(this, edit)) {
        this.value = v2;
        return this;
      }
      return new LeafNode(edit, hash2, key, v2);
    }
    const v = f(none2());
    if (isNone2(v))
      return this;
    ++size.value;
    return mergeLeaves(edit, shift, this.hash, this, hash2, new LeafNode(edit, hash2, key, v));
  }
}

class CollisionNode {
  edit;
  hash;
  children;
  _tag = "CollisionNode";
  constructor(edit, hash2, children) {
    this.edit = edit;
    this.hash = hash2;
    this.children = children;
  }
  modify(edit, shift, f, hash2, key, size) {
    if (hash2 === this.hash) {
      const canEdit = canEditNode(this, edit);
      const list = this.updateCollisionList(canEdit, edit, this.hash, this.children, f, key, size);
      if (list === this.children)
        return this;
      return list.length > 1 ? new CollisionNode(edit, this.hash, list) : list[0];
    }
    const v = f(none2());
    if (isNone2(v))
      return this;
    ++size.value;
    return mergeLeaves(edit, shift, this.hash, this, hash2, new LeafNode(edit, hash2, key, v));
  }
  updateCollisionList(mutate, edit, hash2, list, f, key, size) {
    const len = list.length;
    for (let i = 0;i < len; ++i) {
      const child = list[i];
      if ("key" in child && equals(key, child.key)) {
        const value = child.value;
        const newValue2 = f(value);
        if (newValue2 === value)
          return list;
        if (isNone2(newValue2)) {
          --size.value;
          return arraySpliceOut(mutate, i, list);
        }
        return arrayUpdate(mutate, i, new LeafNode(edit, hash2, key, newValue2), list);
      }
    }
    const newValue = f(none2());
    if (isNone2(newValue))
      return list;
    ++size.value;
    return arrayUpdate(mutate, len, new LeafNode(edit, hash2, key, newValue), list);
  }
}

class IndexedNode {
  edit;
  mask;
  children;
  _tag = "IndexedNode";
  constructor(edit, mask, children) {
    this.edit = edit;
    this.mask = mask;
    this.children = children;
  }
  modify(edit, shift, f, hash2, key, size) {
    const mask = this.mask;
    const children = this.children;
    const frag = hashFragment(shift, hash2);
    const bit = toBitmap(frag);
    const indx = fromBitmap(mask, bit);
    const exists = mask & bit;
    const canEdit = canEditNode(this, edit);
    if (!exists) {
      const _newChild = new EmptyNode().modify(edit, shift + SIZE, f, hash2, key, size);
      if (!_newChild)
        return this;
      return children.length >= MAX_INDEX_NODE ? expand(edit, frag, _newChild, mask, children) : new IndexedNode(edit, mask | bit, arraySpliceIn(canEdit, indx, _newChild, children));
    }
    const current = children[indx];
    const child = current.modify(edit, shift + SIZE, f, hash2, key, size);
    if (current === child)
      return this;
    let bitmap = mask;
    let newChildren;
    if (isEmptyNode(child)) {
      bitmap &= ~bit;
      if (!bitmap)
        return new EmptyNode;
      if (children.length <= 2 && isLeafNode(children[indx ^ 1])) {
        return children[indx ^ 1];
      }
      newChildren = arraySpliceOut(canEdit, indx, children);
    } else {
      newChildren = arrayUpdate(canEdit, indx, child, children);
    }
    if (canEdit) {
      this.mask = bitmap;
      this.children = newChildren;
      return this;
    }
    return new IndexedNode(edit, bitmap, newChildren);
  }
}

class ArrayNode {
  edit;
  size;
  children;
  _tag = "ArrayNode";
  constructor(edit, size, children) {
    this.edit = edit;
    this.size = size;
    this.children = children;
  }
  modify(edit, shift, f, hash2, key, size) {
    let count = this.size;
    const children = this.children;
    const frag = hashFragment(shift, hash2);
    const child = children[frag];
    const newChild = (child || new EmptyNode).modify(edit, shift + SIZE, f, hash2, key, size);
    if (child === newChild)
      return this;
    const canEdit = canEditNode(this, edit);
    let newChildren;
    if (isEmptyNode(child) && !isEmptyNode(newChild)) {
      ++count;
      newChildren = arrayUpdate(canEdit, frag, newChild, children);
    } else if (!isEmptyNode(child) && isEmptyNode(newChild)) {
      --count;
      if (count <= MIN_ARRAY_NODE) {
        return pack(edit, count, frag, children);
      }
      newChildren = arrayUpdate(canEdit, frag, new EmptyNode, children);
    } else {
      newChildren = arrayUpdate(canEdit, frag, newChild, children);
    }
    if (canEdit) {
      this.size = count;
      this.children = newChildren;
      return this;
    }
    return new ArrayNode(edit, count, newChildren);
  }
}
function pack(edit, count, removed, elements) {
  const children = new Array(count - 1);
  let g = 0;
  let bitmap = 0;
  for (let i = 0, len = elements.length;i < len; ++i) {
    if (i !== removed) {
      const elem = elements[i];
      if (elem && !isEmptyNode(elem)) {
        children[g++] = elem;
        bitmap |= 1 << i;
      }
    }
  }
  return new IndexedNode(edit, bitmap, children);
}
function expand(edit, frag, child, bitmap, subNodes) {
  const arr = [];
  let bit = bitmap;
  let count = 0;
  for (let i = 0;bit; ++i) {
    if (bit & 1)
      arr[i] = subNodes[count++];
    bit >>>= 1;
  }
  arr[frag] = child;
  return new ArrayNode(edit, count + 1, arr);
}
function mergeLeavesInner(edit, shift, h1, n1, h2, n2) {
  if (h1 === h2)
    return new CollisionNode(edit, h1, [n2, n1]);
  const subH1 = hashFragment(shift, h1);
  const subH2 = hashFragment(shift, h2);
  if (subH1 === subH2) {
    return (child) => new IndexedNode(edit, toBitmap(subH1) | toBitmap(subH2), [child]);
  } else {
    const children = subH1 < subH2 ? [n1, n2] : [n2, n1];
    return new IndexedNode(edit, toBitmap(subH1) | toBitmap(subH2), children);
  }
}
function mergeLeaves(edit, shift, h1, n1, h2, n2) {
  let stack = undefined;
  let currentShift = shift;
  while (true) {
    const res = mergeLeavesInner(edit, currentShift, h1, n1, h2, n2);
    if (typeof res === "function") {
      stack = make6(res, stack);
      currentShift = currentShift + SIZE;
    } else {
      let final = res;
      while (stack != null) {
        final = stack.value(final);
        stack = stack.previous;
      }
      return final;
    }
  }
}

// node_modules/effect/dist/esm/internal/hashMap.js
var HashMapSymbolKey = "effect/HashMap";
var HashMapTypeId = /* @__PURE__ */ Symbol.for(HashMapSymbolKey);
var HashMapProto = {
  [HashMapTypeId]: HashMapTypeId,
  [Symbol.iterator]() {
    return new HashMapIterator(this, (k, v) => [k, v]);
  },
  [symbol]() {
    let hash2 = hash(HashMapSymbolKey);
    for (const item of this) {
      hash2 ^= pipe(hash(item[0]), combine(hash(item[1])));
    }
    return cached(this, hash2);
  },
  [symbol2](that) {
    if (isHashMap(that)) {
      if (that._size !== this._size) {
        return false;
      }
      for (const item of this) {
        const elem = pipe(that, getHash(item[0], hash(item[0])));
        if (isNone2(elem)) {
          return false;
        } else {
          if (!equals(item[1], elem.value)) {
            return false;
          }
        }
      }
      return true;
    }
    return false;
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "HashMap",
      values: Array.from(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeImpl = (editable, edit, root, size) => {
  const map4 = Object.create(HashMapProto);
  map4._editable = editable;
  map4._edit = edit;
  map4._root = root;
  map4._size = size;
  return map4;
};

class HashMapIterator {
  map;
  f;
  v;
  constructor(map4, f) {
    this.map = map4;
    this.f = f;
    this.v = visitLazy(this.map._root, this.f, undefined);
  }
  next() {
    if (isNone2(this.v)) {
      return {
        done: true,
        value: undefined
      };
    }
    const v0 = this.v.value;
    this.v = applyCont(v0.cont);
    return {
      done: false,
      value: v0.value
    };
  }
  [Symbol.iterator]() {
    return new HashMapIterator(this.map, this.f);
  }
}
var applyCont = (cont) => cont ? visitLazyChildren(cont[0], cont[1], cont[2], cont[3], cont[4]) : none2();
var visitLazy = (node, f, cont = undefined) => {
  switch (node._tag) {
    case "LeafNode": {
      if (isSome2(node.value)) {
        return some2({
          value: f(node.key, node.value.value),
          cont
        });
      }
      return applyCont(cont);
    }
    case "CollisionNode":
    case "ArrayNode":
    case "IndexedNode": {
      const children = node.children;
      return visitLazyChildren(children.length, children, 0, f, cont);
    }
    default: {
      return applyCont(cont);
    }
  }
};
var visitLazyChildren = (len, children, i, f, cont) => {
  while (i < len) {
    const child = children[i++];
    if (child && !isEmptyNode(child)) {
      return visitLazy(child, f, [len, children, i, f, cont]);
    }
  }
  return applyCont(cont);
};
var _empty3 = /* @__PURE__ */ makeImpl(false, 0, /* @__PURE__ */ new EmptyNode, 0);
var empty5 = () => _empty3;
var fromIterable3 = (entries) => {
  const map4 = beginMutation(empty5());
  for (const entry of entries) {
    set(map4, entry[0], entry[1]);
  }
  return endMutation(map4);
};
var isHashMap = (u) => hasProperty(u, HashMapTypeId);
var isEmpty2 = (self) => self && isEmptyNode(self._root);
var get5 = /* @__PURE__ */ dual(2, (self, key) => getHash(self, key, hash(key)));
var getHash = /* @__PURE__ */ dual(3, (self, key, hash2) => {
  let node = self._root;
  let shift = 0;
  while (true) {
    switch (node._tag) {
      case "LeafNode": {
        return equals(key, node.key) ? node.value : none2();
      }
      case "CollisionNode": {
        if (hash2 === node.hash) {
          const children = node.children;
          for (let i = 0, len = children.length;i < len; ++i) {
            const child = children[i];
            if ("key" in child && equals(key, child.key)) {
              return child.value;
            }
          }
        }
        return none2();
      }
      case "IndexedNode": {
        const frag = hashFragment(shift, hash2);
        const bit = toBitmap(frag);
        if (node.mask & bit) {
          node = node.children[fromBitmap(node.mask, bit)];
          shift += SIZE;
          break;
        }
        return none2();
      }
      case "ArrayNode": {
        node = node.children[hashFragment(shift, hash2)];
        if (node) {
          shift += SIZE;
          break;
        }
        return none2();
      }
      default:
        return none2();
    }
  }
});
var has = /* @__PURE__ */ dual(2, (self, key) => isSome2(getHash(self, key, hash(key))));
var set = /* @__PURE__ */ dual(3, (self, key, value) => modifyAt(self, key, () => some2(value)));
var setTree = /* @__PURE__ */ dual(3, (self, newRoot, newSize) => {
  if (self._editable) {
    self._root = newRoot;
    self._size = newSize;
    return self;
  }
  return newRoot === self._root ? self : makeImpl(self._editable, self._edit, newRoot, newSize);
});
var keys = (self) => new HashMapIterator(self, (key) => key);
var size = (self) => self._size;
var beginMutation = (self) => makeImpl(true, self._edit + 1, self._root, self._size);
var endMutation = (self) => {
  self._editable = false;
  return self;
};
var modifyAt = /* @__PURE__ */ dual(3, (self, key, f) => modifyHash(self, key, hash(key), f));
var modifyHash = /* @__PURE__ */ dual(4, (self, key, hash2, f) => {
  const size2 = {
    value: self._size
  };
  const newRoot = self._root.modify(self._editable ? self._edit : NaN, 0, f, hash2, key, size2);
  return pipe(self, setTree(newRoot, size2.value));
});
var remove2 = /* @__PURE__ */ dual(2, (self, key) => modifyAt(self, key, none2));
var map4 = /* @__PURE__ */ dual(2, (self, f) => reduce3(self, empty5(), (map5, value, key) => set(map5, key, f(value, key))));
var forEach = /* @__PURE__ */ dual(2, (self, f) => reduce3(self, undefined, (_, value, key) => f(value, key)));
var reduce3 = /* @__PURE__ */ dual(3, (self, zero, f) => {
  const root = self._root;
  if (root._tag === "LeafNode") {
    return isSome2(root.value) ? f(zero, root.value.value, root.key) : zero;
  }
  if (root._tag === "EmptyNode") {
    return zero;
  }
  const toVisit = [root.children];
  let children;
  while (children = toVisit.pop()) {
    for (let i = 0, len = children.length;i < len; ) {
      const child = children[i++];
      if (child && !isEmptyNode(child)) {
        if (child._tag === "LeafNode") {
          if (isSome2(child.value)) {
            zero = f(zero, child.value.value, child.key);
          }
        } else {
          toVisit.push(child.children);
        }
      }
    }
  }
  return zero;
});

// node_modules/effect/dist/esm/internal/hashSet.js
var HashSetSymbolKey = "effect/HashSet";
var HashSetTypeId = /* @__PURE__ */ Symbol.for(HashSetSymbolKey);
var HashSetProto = {
  [HashSetTypeId]: HashSetTypeId,
  [Symbol.iterator]() {
    return keys(this._keyMap);
  },
  [symbol]() {
    return cached(this, combine(hash(this._keyMap))(hash(HashSetSymbolKey)));
  },
  [symbol2](that) {
    if (isHashSet(that)) {
      return size(this._keyMap) === size(that._keyMap) && equals(this._keyMap, that._keyMap);
    }
    return false;
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "HashSet",
      values: Array.from(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeImpl2 = (keyMap) => {
  const set2 = Object.create(HashSetProto);
  set2._keyMap = keyMap;
  return set2;
};
var isHashSet = (u) => hasProperty(u, HashSetTypeId);
var _empty4 = /* @__PURE__ */ makeImpl2(/* @__PURE__ */ empty5());
var empty6 = () => _empty4;
var fromIterable4 = (elements) => {
  const set2 = beginMutation2(empty6());
  for (const value of elements) {
    add3(set2, value);
  }
  return endMutation2(set2);
};
var make7 = (...elements) => {
  const set2 = beginMutation2(empty6());
  for (const value of elements) {
    add3(set2, value);
  }
  return endMutation2(set2);
};
var has2 = /* @__PURE__ */ dual(2, (self, value) => has(self._keyMap, value));
var size2 = (self) => size(self._keyMap);
var beginMutation2 = (self) => makeImpl2(beginMutation(self._keyMap));
var endMutation2 = (self) => {
  self._keyMap._editable = false;
  return self;
};
var mutate = /* @__PURE__ */ dual(2, (self, f) => {
  const transient = beginMutation2(self);
  f(transient);
  return endMutation2(transient);
});
var add3 = /* @__PURE__ */ dual(2, (self, value) => self._keyMap._editable ? (set(value, true)(self._keyMap), self) : makeImpl2(set(value, true)(self._keyMap)));
var remove3 = /* @__PURE__ */ dual(2, (self, value) => self._keyMap._editable ? (remove2(value)(self._keyMap), self) : makeImpl2(remove2(value)(self._keyMap)));
var difference = /* @__PURE__ */ dual(2, (self, that) => mutate(self, (set2) => {
  for (const value of that) {
    remove3(set2, value);
  }
}));
var union2 = /* @__PURE__ */ dual(2, (self, that) => mutate(empty6(), (set2) => {
  forEach2(self, (value) => add3(set2, value));
  for (const value of that) {
    add3(set2, value);
  }
}));
var forEach2 = /* @__PURE__ */ dual(2, (self, f) => forEach(self._keyMap, (_, k) => f(k)));
var reduce4 = /* @__PURE__ */ dual(3, (self, zero, f) => reduce3(self._keyMap, zero, (z, _, a) => f(z, a)));

// node_modules/effect/dist/esm/HashSet.js
var empty7 = empty6;
var fromIterable5 = fromIterable4;
var make8 = make7;
var has3 = has2;
var size3 = size2;
var add4 = add3;
var remove4 = remove3;
var difference2 = difference;
var union3 = union2;
var reduce5 = reduce4;

// node_modules/effect/dist/esm/MutableRef.js
var TypeId5 = /* @__PURE__ */ Symbol.for("effect/MutableRef");
var MutableRefProto = {
  [TypeId5]: TypeId5,
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "MutableRef",
      current: toJSON(this.current)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var make9 = (value) => {
  const ref = Object.create(MutableRefProto);
  ref.current = value;
  return ref;
};
var compareAndSet = /* @__PURE__ */ dual(3, (self, oldValue, newValue) => {
  if (equals(oldValue, self.current)) {
    self.current = newValue;
    return true;
  }
  return false;
});
var get6 = (self) => self.current;
var set2 = /* @__PURE__ */ dual(2, (self, value) => {
  self.current = value;
  return self;
});

// node_modules/effect/dist/esm/internal/fiberId.js
var FiberIdSymbolKey = "effect/FiberId";
var FiberIdTypeId = /* @__PURE__ */ Symbol.for(FiberIdSymbolKey);
var OP_NONE = "None";
var OP_RUNTIME = "Runtime";
var OP_COMPOSITE = "Composite";
var emptyHash = /* @__PURE__ */ string(`${FiberIdSymbolKey}-${OP_NONE}`);

class None {
  [FiberIdTypeId] = FiberIdTypeId;
  _tag = OP_NONE;
  id = -1;
  startTimeMillis = -1;
  [symbol]() {
    return emptyHash;
  }
  [symbol2](that) {
    return isFiberId(that) && that._tag === OP_NONE;
  }
  toString() {
    return format(this.toJSON());
  }
  toJSON() {
    return {
      _id: "FiberId",
      _tag: this._tag
    };
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
}

class Runtime {
  id;
  startTimeMillis;
  [FiberIdTypeId] = FiberIdTypeId;
  _tag = OP_RUNTIME;
  constructor(id, startTimeMillis) {
    this.id = id;
    this.startTimeMillis = startTimeMillis;
  }
  [symbol]() {
    return cached(this, string(`${FiberIdSymbolKey}-${this._tag}-${this.id}-${this.startTimeMillis}`));
  }
  [symbol2](that) {
    return isFiberId(that) && that._tag === OP_RUNTIME && this.id === that.id && this.startTimeMillis === that.startTimeMillis;
  }
  toString() {
    return format(this.toJSON());
  }
  toJSON() {
    return {
      _id: "FiberId",
      _tag: this._tag,
      id: this.id,
      startTimeMillis: this.startTimeMillis
    };
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
}

class Composite {
  left;
  right;
  [FiberIdTypeId] = FiberIdTypeId;
  _tag = OP_COMPOSITE;
  constructor(left3, right3) {
    this.left = left3;
    this.right = right3;
  }
  _hash;
  [symbol]() {
    return pipe(string(`${FiberIdSymbolKey}-${this._tag}`), combine(hash(this.left)), combine(hash(this.right)), cached(this));
  }
  [symbol2](that) {
    return isFiberId(that) && that._tag === OP_COMPOSITE && equals(this.left, that.left) && equals(this.right, that.right);
  }
  toString() {
    return format(this.toJSON());
  }
  toJSON() {
    return {
      _id: "FiberId",
      _tag: this._tag,
      left: toJSON(this.left),
      right: toJSON(this.right)
    };
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
}
var none3 = /* @__PURE__ */ new None;
var isFiberId = (self) => hasProperty(self, FiberIdTypeId);
var combine2 = /* @__PURE__ */ dual(2, (self, that) => {
  if (self._tag === OP_NONE) {
    return that;
  }
  if (that._tag === OP_NONE) {
    return self;
  }
  return new Composite(self, that);
});
var ids = (self) => {
  switch (self._tag) {
    case OP_NONE: {
      return empty7();
    }
    case OP_RUNTIME: {
      return make8(self.id);
    }
    case OP_COMPOSITE: {
      return pipe(ids(self.left), union3(ids(self.right)));
    }
  }
};
var _fiberCounter = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/Fiber/Id/_fiberCounter"), () => make9(0));
var threadName = (self) => {
  const identifiers = Array.from(ids(self)).map((n) => `#${n}`).join(",");
  return identifiers;
};
var unsafeMake = () => {
  const id = get6(_fiberCounter);
  pipe(_fiberCounter, set2(id + 1));
  return new Runtime(id, Date.now());
};

// node_modules/effect/dist/esm/FiberId.js
var none4 = none3;
var combine3 = combine2;
var threadName2 = threadName;
var unsafeMake2 = unsafeMake;

// node_modules/effect/dist/esm/HashMap.js
var empty8 = empty5;
var fromIterable6 = fromIterable3;
var isEmpty3 = isEmpty2;
var get7 = get5;
var set3 = set;
var keys2 = keys;
var size4 = size;
var modifyAt2 = modifyAt;
var map6 = map4;
var reduce6 = reduce3;

// node_modules/effect/dist/esm/List.js
var TypeId6 = /* @__PURE__ */ Symbol.for("effect/List");
var toArray2 = (self) => Array.from(self);
var getEquivalence3 = (isEquivalent) => mapInput(getEquivalence(isEquivalent), toArray2);
var _equivalence4 = /* @__PURE__ */ getEquivalence3(equals);
var ConsProto = {
  [TypeId6]: TypeId6,
  _tag: "Cons",
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "List",
      _tag: "Cons",
      values: toArray2(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  [symbol2](that) {
    return isList(that) && this._tag === that._tag && _equivalence4(this, that);
  },
  [symbol]() {
    return cached(this, array(toArray2(this)));
  },
  [Symbol.iterator]() {
    let done = false;
    let self = this;
    return {
      next() {
        if (done) {
          return this.return();
        }
        if (self._tag === "Nil") {
          done = true;
          return this.return();
        }
        const value = self.head;
        self = self.tail;
        return {
          done,
          value
        };
      },
      return(value) {
        if (!done) {
          done = true;
        }
        return {
          done: true,
          value
        };
      }
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeCons = (head3, tail) => {
  const cons = Object.create(ConsProto);
  cons.head = head3;
  cons.tail = tail;
  return cons;
};
var NilHash = /* @__PURE__ */ string("Nil");
var NilProto = {
  [TypeId6]: TypeId6,
  _tag: "Nil",
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "List",
      _tag: "Nil"
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  [symbol]() {
    return NilHash;
  },
  [symbol2](that) {
    return isList(that) && this._tag === that._tag;
  },
  [Symbol.iterator]() {
    return {
      next() {
        return {
          done: true,
          value: undefined
        };
      }
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var _Nil = /* @__PURE__ */ Object.create(NilProto);
var isList = (u) => hasProperty(u, TypeId6);
var isNil = (self) => self._tag === "Nil";
var isCons = (self) => self._tag === "Cons";
var nil = () => _Nil;
var cons = (head3, tail) => makeCons(head3, tail);
var empty9 = nil;
var of3 = (value) => makeCons(value, _Nil);
var appendAll3 = /* @__PURE__ */ dual(2, (self, that) => prependAll(that, self));
var prepend3 = /* @__PURE__ */ dual(2, (self, element) => cons(element, self));
var prependAll = /* @__PURE__ */ dual(2, (self, prefix) => {
  if (isNil(self)) {
    return prefix;
  } else if (isNil(prefix)) {
    return self;
  } else {
    const result = makeCons(prefix.head, self);
    let curr = result;
    let that = prefix.tail;
    while (!isNil(that)) {
      const temp = makeCons(that.head, self);
      curr.tail = temp;
      curr = temp;
      that = that.tail;
    }
    return result;
  }
});
var reduce7 = /* @__PURE__ */ dual(3, (self, zero, f) => {
  let acc = zero;
  let these = self;
  while (!isNil(these)) {
    acc = f(acc, these.head);
    these = these.tail;
  }
  return acc;
});
var reverse3 = (self) => {
  let result = empty9();
  let these = self;
  while (!isNil(these)) {
    result = prepend3(result, these.head);
    these = these.tail;
  }
  return result;
};

// node_modules/effect/dist/esm/internal/data.js
var ArrayProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(Array.prototype), {
  [symbol]() {
    return cached(this, array(this));
  },
  [symbol2](that) {
    if (Array.isArray(that) && this.length === that.length) {
      return this.every((v, i) => equals(v, that[i]));
    } else {
      return false;
    }
  }
});
var Structural = /* @__PURE__ */ function() {
  function Structural2(args) {
    if (args) {
      Object.assign(this, args);
    }
  }
  Structural2.prototype = StructuralPrototype;
  return Structural2;
}();
var struct = (as) => Object.assign(Object.create(StructuralPrototype), as);

// node_modules/effect/dist/esm/internal/differ/chunkPatch.js
var ChunkPatchTypeId = /* @__PURE__ */ Symbol.for("effect/DifferChunkPatch");
function variance(a) {
  return a;
}
var PatchProto = {
  ...Structural.prototype,
  [ChunkPatchTypeId]: {
    _Value: variance,
    _Patch: variance
  }
};

// node_modules/effect/dist/esm/internal/differ/contextPatch.js
var ContextPatchTypeId = /* @__PURE__ */ Symbol.for("effect/DifferContextPatch");
function variance2(a) {
  return a;
}
var PatchProto2 = {
  ...Structural.prototype,
  [ContextPatchTypeId]: {
    _Value: variance2,
    _Patch: variance2
  }
};
var EmptyProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto2), {
  _tag: "Empty"
});
var _empty5 = /* @__PURE__ */ Object.create(EmptyProto);
var empty10 = () => _empty5;
var AndThenProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto2), {
  _tag: "AndThen"
});
var makeAndThen = (first, second) => {
  const o = Object.create(AndThenProto);
  o.first = first;
  o.second = second;
  return o;
};
var AddServiceProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto2), {
  _tag: "AddService"
});
var makeAddService = (key, service) => {
  const o = Object.create(AddServiceProto);
  o.key = key;
  o.service = service;
  return o;
};
var RemoveServiceProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto2), {
  _tag: "RemoveService"
});
var makeRemoveService = (key) => {
  const o = Object.create(RemoveServiceProto);
  o.key = key;
  return o;
};
var UpdateServiceProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto2), {
  _tag: "UpdateService"
});
var makeUpdateService = (key, update) => {
  const o = Object.create(UpdateServiceProto);
  o.key = key;
  o.update = update;
  return o;
};
var diff = (oldValue, newValue) => {
  const missingServices = new Map(oldValue.unsafeMap);
  let patch = empty10();
  for (const [tag, newService] of newValue.unsafeMap.entries()) {
    if (missingServices.has(tag)) {
      const old = missingServices.get(tag);
      missingServices.delete(tag);
      if (!equals(old, newService)) {
        patch = combine4(makeUpdateService(tag, () => newService))(patch);
      }
    } else {
      missingServices.delete(tag);
      patch = combine4(makeAddService(tag, newService))(patch);
    }
  }
  for (const [tag] of missingServices.entries()) {
    patch = combine4(makeRemoveService(tag))(patch);
  }
  return patch;
};
var combine4 = /* @__PURE__ */ dual(2, (self, that) => makeAndThen(self, that));
var patch = /* @__PURE__ */ dual(2, (self, context) => {
  if (self._tag === "Empty") {
    return context;
  }
  let wasServiceUpdated = false;
  let patches = of2(self);
  const updatedContext = new Map(context.unsafeMap);
  while (isNonEmpty(patches)) {
    const head3 = headNonEmpty2(patches);
    const tail = tailNonEmpty2(patches);
    switch (head3._tag) {
      case "Empty": {
        patches = tail;
        break;
      }
      case "AddService": {
        updatedContext.set(head3.key, head3.service);
        patches = tail;
        break;
      }
      case "AndThen": {
        patches = prepend2(prepend2(tail, head3.second), head3.first);
        break;
      }
      case "RemoveService": {
        updatedContext.delete(head3.key);
        patches = tail;
        break;
      }
      case "UpdateService": {
        updatedContext.set(head3.key, head3.update(updatedContext.get(head3.key)));
        wasServiceUpdated = true;
        patches = tail;
        break;
      }
    }
  }
  if (!wasServiceUpdated) {
    return makeContext(updatedContext);
  }
  const map7 = new Map;
  for (const [tag] of context.unsafeMap) {
    if (updatedContext.has(tag)) {
      map7.set(tag, updatedContext.get(tag));
      updatedContext.delete(tag);
    }
  }
  for (const [tag, s] of updatedContext) {
    map7.set(tag, s);
  }
  return makeContext(map7);
});

// node_modules/effect/dist/esm/internal/differ/hashMapPatch.js
var HashMapPatchTypeId = /* @__PURE__ */ Symbol.for("effect/DifferHashMapPatch");
function variance3(a) {
  return a;
}
var PatchProto3 = {
  ...Structural.prototype,
  [HashMapPatchTypeId]: {
    _Value: variance3,
    _Key: variance3,
    _Patch: variance3
  }
};

// node_modules/effect/dist/esm/internal/differ/hashSetPatch.js
var HashSetPatchTypeId = /* @__PURE__ */ Symbol.for("effect/DifferHashSetPatch");
function variance4(a) {
  return a;
}
var PatchProto4 = {
  ...Structural.prototype,
  [HashSetPatchTypeId]: {
    _Value: variance4,
    _Key: variance4,
    _Patch: variance4
  }
};
var EmptyProto2 = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto4), {
  _tag: "Empty"
});
var _empty6 = /* @__PURE__ */ Object.create(EmptyProto2);
var empty11 = () => _empty6;
var AndThenProto2 = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto4), {
  _tag: "AndThen"
});
var makeAndThen2 = (first, second) => {
  const o = Object.create(AndThenProto2);
  o.first = first;
  o.second = second;
  return o;
};
var AddProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto4), {
  _tag: "Add"
});
var makeAdd = (value) => {
  const o = Object.create(AddProto);
  o.value = value;
  return o;
};
var RemoveProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto4), {
  _tag: "Remove"
});
var makeRemove = (value) => {
  const o = Object.create(RemoveProto);
  o.value = value;
  return o;
};
var diff2 = (oldValue, newValue) => {
  const [removed, patch2] = reduce5([oldValue, empty11()], ([set4, patch3], value) => {
    if (has3(value)(set4)) {
      return [remove4(value)(set4), patch3];
    }
    return [set4, combine5(makeAdd(value))(patch3)];
  })(newValue);
  return reduce5(patch2, (patch3, value) => combine5(makeRemove(value))(patch3))(removed);
};
var combine5 = /* @__PURE__ */ dual(2, (self, that) => makeAndThen2(self, that));
var patch2 = /* @__PURE__ */ dual(2, (self, oldValue) => {
  if (self._tag === "Empty") {
    return oldValue;
  }
  let set4 = oldValue;
  let patches = of2(self);
  while (isNonEmpty(patches)) {
    const head3 = headNonEmpty2(patches);
    const tail = tailNonEmpty2(patches);
    switch (head3._tag) {
      case "Empty": {
        patches = tail;
        break;
      }
      case "AndThen": {
        patches = prepend2(head3.first)(prepend2(head3.second)(tail));
        break;
      }
      case "Add": {
        set4 = add4(head3.value)(set4);
        patches = tail;
        break;
      }
      case "Remove": {
        set4 = remove4(head3.value)(set4);
        patches = tail;
      }
    }
  }
  return set4;
});

// node_modules/effect/dist/esm/internal/differ/orPatch.js
var OrPatchTypeId = /* @__PURE__ */ Symbol.for("effect/DifferOrPatch");
function variance5(a) {
  return a;
}
var PatchProto5 = {
  ...Structural.prototype,
  [OrPatchTypeId]: {
    _Value: variance5,
    _Key: variance5,
    _Patch: variance5
  }
};

// node_modules/effect/dist/esm/internal/differ/readonlyArrayPatch.js
var ReadonlyArrayPatchTypeId = /* @__PURE__ */ Symbol.for("effect/DifferReadonlyArrayPatch");
function variance6(a) {
  return a;
}
var PatchProto6 = {
  ...Structural.prototype,
  [ReadonlyArrayPatchTypeId]: {
    _Value: variance6,
    _Patch: variance6
  }
};
var EmptyProto3 = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto6), {
  _tag: "Empty"
});
var _empty7 = /* @__PURE__ */ Object.create(EmptyProto3);
var empty12 = () => _empty7;
var AndThenProto3 = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto6), {
  _tag: "AndThen"
});
var makeAndThen3 = (first, second) => {
  const o = Object.create(AndThenProto3);
  o.first = first;
  o.second = second;
  return o;
};
var AppendProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto6), {
  _tag: "Append"
});
var makeAppend = (values3) => {
  const o = Object.create(AppendProto);
  o.values = values3;
  return o;
};
var SliceProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto6), {
  _tag: "Slice"
});
var makeSlice = (from, until) => {
  const o = Object.create(SliceProto);
  o.from = from;
  o.until = until;
  return o;
};
var UpdateProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(PatchProto6), {
  _tag: "Update"
});
var makeUpdate = (index, patch3) => {
  const o = Object.create(UpdateProto);
  o.index = index;
  o.patch = patch3;
  return o;
};
var diff3 = (options) => {
  let i = 0;
  let patch3 = empty12();
  while (i < options.oldValue.length && i < options.newValue.length) {
    const oldElement = options.oldValue[i];
    const newElement = options.newValue[i];
    const valuePatch = options.differ.diff(oldElement, newElement);
    if (!equals(valuePatch, options.differ.empty)) {
      patch3 = combine6(patch3, makeUpdate(i, valuePatch));
    }
    i = i + 1;
  }
  if (i < options.oldValue.length) {
    patch3 = combine6(patch3, makeSlice(0, i));
  }
  if (i < options.newValue.length) {
    patch3 = combine6(patch3, makeAppend(drop(i)(options.newValue)));
  }
  return patch3;
};
var combine6 = /* @__PURE__ */ dual(2, (self, that) => makeAndThen3(self, that));
var patch3 = /* @__PURE__ */ dual(3, (self, oldValue, differ) => {
  if (self._tag === "Empty") {
    return oldValue;
  }
  let readonlyArray = oldValue.slice();
  let patches = of(self);
  while (isNonEmptyArray2(patches)) {
    const head3 = headNonEmpty(patches);
    const tail = tailNonEmpty(patches);
    switch (head3._tag) {
      case "Empty": {
        patches = tail;
        break;
      }
      case "AndThen": {
        tail.unshift(head3.first, head3.second);
        patches = tail;
        break;
      }
      case "Append": {
        for (const value of head3.values) {
          readonlyArray.push(value);
        }
        patches = tail;
        break;
      }
      case "Slice": {
        readonlyArray = readonlyArray.slice(head3.from, head3.until);
        patches = tail;
        break;
      }
      case "Update": {
        readonlyArray[head3.index] = differ.patch(head3.patch, readonlyArray[head3.index]);
        patches = tail;
        break;
      }
    }
  }
  return readonlyArray;
});

// node_modules/effect/dist/esm/internal/differ.js
var DifferTypeId = /* @__PURE__ */ Symbol.for("effect/Differ");
var DifferProto = {
  [DifferTypeId]: {
    _P: identity,
    _V: identity
  }
};
var make12 = (params) => {
  const differ = Object.create(DifferProto);
  differ.empty = params.empty;
  differ.diff = params.diff;
  differ.combine = params.combine;
  differ.patch = params.patch;
  return differ;
};
var environment = () => make12({
  empty: empty10(),
  combine: (first, second) => combine4(second)(first),
  diff: (oldValue, newValue) => diff(oldValue, newValue),
  patch: (patch7, oldValue) => patch(oldValue)(patch7)
});
var hashSet = () => make12({
  empty: empty11(),
  combine: (first, second) => combine5(second)(first),
  diff: (oldValue, newValue) => diff2(oldValue, newValue),
  patch: (patch7, oldValue) => patch2(oldValue)(patch7)
});
var readonlyArray = (differ) => make12({
  empty: empty12(),
  combine: (first, second) => combine6(first, second),
  diff: (oldValue, newValue) => diff3({
    oldValue,
    newValue,
    differ
  }),
  patch: (patch7, oldValue) => patch3(patch7, oldValue, differ)
});
var update = () => updateWith((_, a) => a);
var updateWith = (f) => make12({
  empty: identity,
  combine: (first, second) => {
    if (first === identity) {
      return second;
    }
    if (second === identity) {
      return first;
    }
    return (a) => second(first(a));
  },
  diff: (oldValue, newValue) => {
    if (equals(oldValue, newValue)) {
      return identity;
    }
    return constant(newValue);
  },
  patch: (patch7, oldValue) => f(oldValue, patch7(oldValue))
});

// node_modules/effect/dist/esm/internal/runtimeFlagsPatch.js
var BIT_MASK = 255;
var BIT_SHIFT = 8;
var active = (patch7) => patch7 & BIT_MASK;
var enabled = (patch7) => patch7 >> BIT_SHIFT & BIT_MASK;
var make13 = (active2, enabled2) => (active2 & BIT_MASK) + ((enabled2 & active2 & BIT_MASK) << BIT_SHIFT);
var empty16 = /* @__PURE__ */ make13(0, 0);
var enable = (flag) => make13(flag, flag);
var disable = (flag) => make13(flag, 0);
var exclude = /* @__PURE__ */ dual(2, (self, flag) => make13(active(self) & ~flag, enabled(self)));
var andThen = /* @__PURE__ */ dual(2, (self, that) => self | that);
var invert = (n) => ~n >>> 0 & BIT_MASK;

// node_modules/effect/dist/esm/internal/runtimeFlags.js
var None2 = 0;
var Interruption = 1 << 0;
var OpSupervision = 1 << 1;
var RuntimeMetrics = 1 << 2;
var WindDown = 1 << 4;
var CooperativeYielding = 1 << 5;
var cooperativeYielding = (self) => isEnabled(self, CooperativeYielding);
var enable2 = /* @__PURE__ */ dual(2, (self, flag) => self | flag);
var interruptible = (self) => interruption(self) && !windDown(self);
var interruption = (self) => isEnabled(self, Interruption);
var isEnabled = /* @__PURE__ */ dual(2, (self, flag) => (self & flag) !== 0);
var make14 = (...flags) => flags.reduce((a, b) => a | b, 0);
var none5 = /* @__PURE__ */ make14(None2);
var runtimeMetrics = (self) => isEnabled(self, RuntimeMetrics);
var windDown = (self) => isEnabled(self, WindDown);
var diff7 = /* @__PURE__ */ dual(2, (self, that) => make13(self ^ that, that));
var patch7 = /* @__PURE__ */ dual(2, (self, patch8) => self & (invert(active(patch8)) | enabled(patch8)) | active(patch8) & enabled(patch8));
var differ = /* @__PURE__ */ make12({
  empty: empty16,
  diff: (oldValue, newValue) => diff7(oldValue, newValue),
  combine: (first, second) => andThen(second)(first),
  patch: (_patch, oldValue) => patch7(oldValue, _patch)
});

// node_modules/effect/dist/esm/RuntimeFlagsPatch.js
var enable3 = enable;
var disable2 = disable;
var exclude2 = exclude;

// node_modules/effect/dist/esm/internal/blockedRequests.js
var par = (self, that) => ({
  _tag: "Par",
  left: self,
  right: that
});
var seq = (self, that) => ({
  _tag: "Seq",
  left: self,
  right: that
});
var flatten2 = (self) => {
  let current = of3(self);
  let updated = empty9();
  while (true) {
    const [parallel, sequential] = reduce7(current, [parallelCollectionEmpty(), empty9()], ([parallel2, sequential2], blockedRequest) => {
      const [par2, seq2] = step(blockedRequest);
      return [parallelCollectionCombine(parallel2, par2), appendAll3(sequential2, seq2)];
    });
    updated = merge4(updated, parallel);
    if (isNil(sequential)) {
      return reverse3(updated);
    }
    current = sequential;
  }
  throw new Error("BUG: BlockedRequests.flatten - please report an issue at https://github.com/Effect-TS/effect/issues");
};
var step = (requests) => {
  let current = requests;
  let parallel = parallelCollectionEmpty();
  let stack = empty9();
  let sequential = empty9();
  while (true) {
    switch (current._tag) {
      case "Empty": {
        if (isNil(stack)) {
          return [parallel, sequential];
        }
        current = stack.head;
        stack = stack.tail;
        break;
      }
      case "Par": {
        stack = cons(current.right, stack);
        current = current.left;
        break;
      }
      case "Seq": {
        const left3 = current.left;
        const right3 = current.right;
        switch (left3._tag) {
          case "Empty": {
            current = right3;
            break;
          }
          case "Par": {
            const l = left3.left;
            const r = left3.right;
            current = par(seq(l, right3), seq(r, right3));
            break;
          }
          case "Seq": {
            const l = left3.left;
            const r = left3.right;
            current = seq(l, seq(r, right3));
            break;
          }
          case "Single": {
            current = left3;
            sequential = cons(right3, sequential);
            break;
          }
        }
        break;
      }
      case "Single": {
        parallel = parallelCollectionAdd(parallel, current);
        if (isNil(stack)) {
          return [parallel, sequential];
        }
        current = stack.head;
        stack = stack.tail;
        break;
      }
    }
  }
  throw new Error("BUG: BlockedRequests.step - please report an issue at https://github.com/Effect-TS/effect/issues");
};
var merge4 = (sequential, parallel) => {
  if (isNil(sequential)) {
    return of3(parallelCollectionToSequentialCollection(parallel));
  }
  if (parallelCollectionIsEmpty(parallel)) {
    return sequential;
  }
  const seqHeadKeys = sequentialCollectionKeys(sequential.head);
  const parKeys = parallelCollectionKeys(parallel);
  if (seqHeadKeys.length === 1 && parKeys.length === 1 && equals(seqHeadKeys[0], parKeys[0])) {
    return cons(sequentialCollectionCombine(sequential.head, parallelCollectionToSequentialCollection(parallel)), sequential.tail);
  }
  return cons(parallelCollectionToSequentialCollection(parallel), sequential);
};
var RequestBlockParallelTypeId = /* @__PURE__ */ Symbol.for("effect/RequestBlock/RequestBlockParallel");
var parallelVariance = {
  _R: (_) => _
};

class ParallelImpl {
  map;
  [RequestBlockParallelTypeId] = parallelVariance;
  constructor(map7) {
    this.map = map7;
  }
}
var parallelCollectionEmpty = () => new ParallelImpl(empty8());
var parallelCollectionAdd = (self, blockedRequest) => new ParallelImpl(modifyAt2(self.map, blockedRequest.dataSource, (_) => orElseSome(map(_, append2(blockedRequest.blockedRequest)), () => of2(blockedRequest.blockedRequest))));
var parallelCollectionCombine = (self, that) => new ParallelImpl(reduce6(self.map, that.map, (map7, value, key) => set3(map7, key, match(get7(map7, key), {
  onNone: () => value,
  onSome: (other) => appendAll2(value, other)
}))));
var parallelCollectionIsEmpty = (self) => isEmpty3(self.map);
var parallelCollectionKeys = (self) => Array.from(keys2(self.map));
var parallelCollectionToSequentialCollection = (self) => sequentialCollectionMake(map6(self.map, (x) => of2(x)));
var SequentialCollectionTypeId = /* @__PURE__ */ Symbol.for("effect/RequestBlock/RequestBlockSequential");
var sequentialVariance = {
  _R: (_) => _
};

class SequentialImpl {
  map;
  [SequentialCollectionTypeId] = sequentialVariance;
  constructor(map7) {
    this.map = map7;
  }
}
var sequentialCollectionMake = (map7) => new SequentialImpl(map7);
var sequentialCollectionCombine = (self, that) => new SequentialImpl(reduce6(that.map, self.map, (map7, value, key) => set3(map7, key, match(get7(map7, key), {
  onNone: () => empty4(),
  onSome: (a) => appendAll2(a, value)
}))));
var sequentialCollectionKeys = (self) => Array.from(keys2(self.map));
var sequentialCollectionToChunk = (self) => Array.from(self.map);

// node_modules/effect/dist/esm/internal/errors.js
var getBugErrorMessage = (message) => `BUG: ${message} - please report an issue at https://github.com/Effect-TS/effect/issues`;

// node_modules/effect/dist/esm/internal/opCodes/cause.js
var OP_DIE = "Die";
var OP_EMPTY = "Empty";
var OP_FAIL = "Fail";
var OP_INTERRUPT = "Interrupt";
var OP_PARALLEL = "Parallel";
var OP_SEQUENTIAL = "Sequential";

// node_modules/effect/dist/esm/internal/cause.js
var CauseSymbolKey = "effect/Cause";
var CauseTypeId = /* @__PURE__ */ Symbol.for(CauseSymbolKey);
var variance7 = {
  _E: (_) => _
};
var proto = {
  [CauseTypeId]: variance7,
  [symbol]() {
    return pipe(hash(CauseSymbolKey), combine(hash(flattenCause(this))), cached(this));
  },
  [symbol2](that) {
    return isCause(that) && causeEquals(this, that);
  },
  pipe() {
    return pipeArguments(this, arguments);
  },
  toJSON() {
    switch (this._tag) {
      case "Empty":
        return {
          _id: "Cause",
          _tag: this._tag
        };
      case "Die":
        return {
          _id: "Cause",
          _tag: this._tag,
          defect: toJSON(this.defect)
        };
      case "Interrupt":
        return {
          _id: "Cause",
          _tag: this._tag,
          fiberId: this.fiberId.toJSON()
        };
      case "Fail":
        return {
          _id: "Cause",
          _tag: this._tag,
          failure: toJSON(this.error)
        };
      case "Sequential":
      case "Parallel":
        return {
          _id: "Cause",
          _tag: this._tag,
          left: toJSON(this.left),
          right: toJSON(this.right)
        };
    }
  },
  toString() {
    return pretty(this);
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
};
var empty17 = /* @__PURE__ */ (() => {
  const o = /* @__PURE__ */ Object.create(proto);
  o._tag = OP_EMPTY;
  return o;
})();
var fail = (error) => {
  const o = Object.create(proto);
  o._tag = OP_FAIL;
  o.error = error;
  return o;
};
var die = (defect) => {
  const o = Object.create(proto);
  o._tag = OP_DIE;
  o.defect = defect;
  return o;
};
var interrupt = (fiberId) => {
  const o = Object.create(proto);
  o._tag = OP_INTERRUPT;
  o.fiberId = fiberId;
  return o;
};
var parallel = (left3, right3) => {
  const o = Object.create(proto);
  o._tag = OP_PARALLEL;
  o.left = left3;
  o.right = right3;
  return o;
};
var sequential = (left3, right3) => {
  const o = Object.create(proto);
  o._tag = OP_SEQUENTIAL;
  o.left = left3;
  o.right = right3;
  return o;
};
var isCause = (u) => hasProperty(u, CauseTypeId);
var isDieType = (self) => self._tag === OP_DIE;
var isEmpty5 = (self) => {
  if (self._tag === OP_EMPTY) {
    return true;
  }
  return reduce8(self, true, (acc, cause) => {
    switch (cause._tag) {
      case OP_EMPTY: {
        return some2(acc);
      }
      case OP_DIE:
      case OP_FAIL:
      case OP_INTERRUPT: {
        return some2(false);
      }
      default: {
        return none2();
      }
    }
  });
};
var isInterrupted = (self) => isSome2(interruptOption(self));
var isInterruptedOnly = (self) => reduceWithContext(undefined, IsInterruptedOnlyCauseReducer)(self);
var failures = (self) => reverse2(reduce8(self, empty4(), (list, cause) => cause._tag === OP_FAIL ? some2(pipe(list, prepend2(cause.error))) : none2()));
var defects = (self) => reverse2(reduce8(self, empty4(), (list, cause) => cause._tag === OP_DIE ? some2(pipe(list, prepend2(cause.defect))) : none2()));
var interruptors = (self) => reduce8(self, empty7(), (set4, cause) => cause._tag === OP_INTERRUPT ? some2(pipe(set4, add4(cause.fiberId))) : none2());
var failureOption = (self) => find(self, (cause) => cause._tag === OP_FAIL ? some2(cause.error) : none2());
var failureOrCause = (self) => {
  const option = failureOption(self);
  switch (option._tag) {
    case "None": {
      return right2(self);
    }
    case "Some": {
      return left2(option.value);
    }
  }
};
var flipCauseOption = (self) => match3(self, {
  onEmpty: some2(empty17),
  onFail: (failureOption2) => pipe(failureOption2, map(fail)),
  onDie: (defect) => some2(die(defect)),
  onInterrupt: (fiberId) => some2(interrupt(fiberId)),
  onSequential: (left3, right3) => {
    if (isSome2(left3) && isSome2(right3)) {
      return some2(sequential(left3.value, right3.value));
    }
    if (isNone2(left3) && isSome2(right3)) {
      return some2(right3.value);
    }
    if (isSome2(left3) && isNone2(right3)) {
      return some2(left3.value);
    }
    return none2();
  },
  onParallel: (left3, right3) => {
    if (isSome2(left3) && isSome2(right3)) {
      return some2(parallel(left3.value, right3.value));
    }
    if (isNone2(left3) && isSome2(right3)) {
      return some2(right3.value);
    }
    if (isSome2(left3) && isNone2(right3)) {
      return some2(left3.value);
    }
    return none2();
  }
});
var interruptOption = (self) => find(self, (cause) => cause._tag === OP_INTERRUPT ? some2(cause.fiberId) : none2());
var stripFailures = (self) => match3(self, {
  onEmpty: empty17,
  onFail: () => empty17,
  onDie: (defect) => die(defect),
  onInterrupt: (fiberId) => interrupt(fiberId),
  onSequential: sequential,
  onParallel: parallel
});
var electFailures = (self) => match3(self, {
  onEmpty: empty17,
  onFail: (failure) => die(failure),
  onDie: (defect) => die(defect),
  onInterrupt: (fiberId) => interrupt(fiberId),
  onSequential: (left3, right3) => sequential(left3, right3),
  onParallel: (left3, right3) => parallel(left3, right3)
});
var map8 = /* @__PURE__ */ dual(2, (self, f) => flatMap6(self, (e) => fail(f(e))));
var flatMap6 = /* @__PURE__ */ dual(2, (self, f) => match3(self, {
  onEmpty: empty17,
  onFail: (error) => f(error),
  onDie: (defect) => die(defect),
  onInterrupt: (fiberId) => interrupt(fiberId),
  onSequential: (left3, right3) => sequential(left3, right3),
  onParallel: (left3, right3) => parallel(left3, right3)
}));
var causeEquals = (left3, right3) => {
  let leftStack = of2(left3);
  let rightStack = of2(right3);
  while (isNonEmpty(leftStack) && isNonEmpty(rightStack)) {
    const [leftParallel, leftSequential] = pipe(headNonEmpty2(leftStack), reduce8([empty7(), empty4()], ([parallel2, sequential2], cause) => {
      const [par2, seq2] = evaluateCause(cause);
      return some2([pipe(parallel2, union3(par2)), pipe(sequential2, appendAll2(seq2))]);
    }));
    const [rightParallel, rightSequential] = pipe(headNonEmpty2(rightStack), reduce8([empty7(), empty4()], ([parallel2, sequential2], cause) => {
      const [par2, seq2] = evaluateCause(cause);
      return some2([pipe(parallel2, union3(par2)), pipe(sequential2, appendAll2(seq2))]);
    }));
    if (!equals(leftParallel, rightParallel)) {
      return false;
    }
    leftStack = leftSequential;
    rightStack = rightSequential;
  }
  return true;
};
var flattenCause = (cause) => {
  return flattenCauseLoop(of2(cause), empty4());
};
var flattenCauseLoop = (causes, flattened) => {
  while (true) {
    const [parallel2, sequential2] = pipe(causes, reduce([empty7(), empty4()], ([parallel3, sequential3], cause) => {
      const [par2, seq2] = evaluateCause(cause);
      return [pipe(parallel3, union3(par2)), pipe(sequential3, appendAll2(seq2))];
    }));
    const updated = size3(parallel2) > 0 ? pipe(flattened, prepend2(parallel2)) : flattened;
    if (isEmpty(sequential2)) {
      return reverse2(updated);
    }
    causes = sequential2;
    flattened = updated;
  }
  throw new Error(getBugErrorMessage("Cause.flattenCauseLoop"));
};
var find = /* @__PURE__ */ dual(2, (self, pf) => {
  const stack = [self];
  while (stack.length > 0) {
    const item = stack.pop();
    const option = pf(item);
    switch (option._tag) {
      case "None": {
        switch (item._tag) {
          case OP_SEQUENTIAL:
          case OP_PARALLEL: {
            stack.push(item.right);
            stack.push(item.left);
            break;
          }
        }
        break;
      }
      case "Some": {
        return option;
      }
    }
  }
  return none2();
});
var evaluateCause = (self) => {
  let cause = self;
  const stack = [];
  let _parallel = empty7();
  let _sequential = empty4();
  while (cause !== undefined) {
    switch (cause._tag) {
      case OP_EMPTY: {
        if (stack.length === 0) {
          return [_parallel, _sequential];
        }
        cause = stack.pop();
        break;
      }
      case OP_FAIL: {
        _parallel = add4(_parallel, cause.error);
        if (stack.length === 0) {
          return [_parallel, _sequential];
        }
        cause = stack.pop();
        break;
      }
      case OP_DIE: {
        _parallel = add4(_parallel, cause.defect);
        if (stack.length === 0) {
          return [_parallel, _sequential];
        }
        cause = stack.pop();
        break;
      }
      case OP_INTERRUPT: {
        _parallel = add4(_parallel, cause.fiberId);
        if (stack.length === 0) {
          return [_parallel, _sequential];
        }
        cause = stack.pop();
        break;
      }
      case OP_SEQUENTIAL: {
        switch (cause.left._tag) {
          case OP_EMPTY: {
            cause = cause.right;
            break;
          }
          case OP_SEQUENTIAL: {
            cause = sequential(cause.left.left, sequential(cause.left.right, cause.right));
            break;
          }
          case OP_PARALLEL: {
            cause = parallel(sequential(cause.left.left, cause.right), sequential(cause.left.right, cause.right));
            break;
          }
          default: {
            _sequential = prepend2(_sequential, cause.right);
            cause = cause.left;
            break;
          }
        }
        break;
      }
      case OP_PARALLEL: {
        stack.push(cause.right);
        cause = cause.left;
        break;
      }
    }
  }
  throw new Error(getBugErrorMessage("Cause.evaluateCauseLoop"));
};
var IsInterruptedOnlyCauseReducer = {
  emptyCase: constTrue,
  failCase: constFalse,
  dieCase: constFalse,
  interruptCase: constTrue,
  sequentialCase: (_, left3, right3) => left3 && right3,
  parallelCase: (_, left3, right3) => left3 && right3
};
var OP_SEQUENTIAL_CASE = "SequentialCase";
var OP_PARALLEL_CASE = "ParallelCase";
var match3 = /* @__PURE__ */ dual(2, (self, {
  onDie,
  onEmpty,
  onFail,
  onInterrupt,
  onParallel,
  onSequential
}) => {
  return reduceWithContext(self, undefined, {
    emptyCase: () => onEmpty,
    failCase: (_, error) => onFail(error),
    dieCase: (_, defect) => onDie(defect),
    interruptCase: (_, fiberId) => onInterrupt(fiberId),
    sequentialCase: (_, left3, right3) => onSequential(left3, right3),
    parallelCase: (_, left3, right3) => onParallel(left3, right3)
  });
});
var reduce8 = /* @__PURE__ */ dual(3, (self, zero, pf) => {
  let accumulator = zero;
  let cause = self;
  const causes = [];
  while (cause !== undefined) {
    const option = pf(accumulator, cause);
    accumulator = isSome2(option) ? option.value : accumulator;
    switch (cause._tag) {
      case OP_SEQUENTIAL: {
        causes.push(cause.right);
        cause = cause.left;
        break;
      }
      case OP_PARALLEL: {
        causes.push(cause.right);
        cause = cause.left;
        break;
      }
      default: {
        cause = undefined;
        break;
      }
    }
    if (cause === undefined && causes.length > 0) {
      cause = causes.pop();
    }
  }
  return accumulator;
});
var reduceWithContext = /* @__PURE__ */ dual(3, (self, context, reducer) => {
  const input = [self];
  const output = [];
  while (input.length > 0) {
    const cause = input.pop();
    switch (cause._tag) {
      case OP_EMPTY: {
        output.push(right2(reducer.emptyCase(context)));
        break;
      }
      case OP_FAIL: {
        output.push(right2(reducer.failCase(context, cause.error)));
        break;
      }
      case OP_DIE: {
        output.push(right2(reducer.dieCase(context, cause.defect)));
        break;
      }
      case OP_INTERRUPT: {
        output.push(right2(reducer.interruptCase(context, cause.fiberId)));
        break;
      }
      case OP_SEQUENTIAL: {
        input.push(cause.right);
        input.push(cause.left);
        output.push(left2({
          _tag: OP_SEQUENTIAL_CASE
        }));
        break;
      }
      case OP_PARALLEL: {
        input.push(cause.right);
        input.push(cause.left);
        output.push(left2({
          _tag: OP_PARALLEL_CASE
        }));
        break;
      }
    }
  }
  const accumulator = [];
  while (output.length > 0) {
    const either2 = output.pop();
    switch (either2._tag) {
      case "Left": {
        switch (either2.left._tag) {
          case OP_SEQUENTIAL_CASE: {
            const left3 = accumulator.pop();
            const right3 = accumulator.pop();
            const value = reducer.sequentialCase(context, left3, right3);
            accumulator.push(value);
            break;
          }
          case OP_PARALLEL_CASE: {
            const left3 = accumulator.pop();
            const right3 = accumulator.pop();
            const value = reducer.parallelCase(context, left3, right3);
            accumulator.push(value);
            break;
          }
        }
        break;
      }
      case "Right": {
        accumulator.push(either2.right);
        break;
      }
    }
  }
  if (accumulator.length === 0) {
    throw new Error("BUG: Cause.reduceWithContext - please report an issue at https://github.com/Effect-TS/effect/issues");
  }
  return accumulator.pop();
});
var filterStack = (stack) => {
  const lines = stack.split(`
`);
  const out = [];
  for (let i = 0;i < lines.length; i++) {
    out.push(lines[i].replace(/at .*effect_instruction_i.*\((.*)\)/, "at $1"));
    if (lines[i].includes("effect_instruction_i")) {
      return out.join(`
`);
    }
  }
  return out.join(`
`);
};
var pretty = (cause) => {
  if (isInterruptedOnly(cause)) {
    return "All fibers interrupted without errors.";
  }
  const final = prettyErrors(cause).map((e) => {
    let message = e.message;
    if (e.stack) {
      message += `\r
${filterStack(e.stack)}`;
    }
    if (e.span) {
      let current = e.span;
      let i = 0;
      while (current && current._tag === "Span" && i < 10) {
        message += `\r
    at ${current.name}`;
        current = getOrUndefined(current.parent);
        i++;
      }
    }
    return message;
  }).join(`\r
`);
  return final;
};

class PrettyError {
  message;
  stack;
  span;
  constructor(message, stack, span2) {
    this.message = message;
    this.stack = stack;
    this.span = span2;
  }
  toJSON() {
    const out = {
      message: this.message
    };
    if (this.stack) {
      out.stack = this.stack;
    }
    if (this.span) {
      out.span = this.span;
    }
    return out;
  }
}
var prettyErrorMessage = (u) => {
  if (typeof u === "string") {
    return `Error: ${u}`;
  }
  try {
    if (hasProperty(u, "toString") && isFunction2(u["toString"]) && u["toString"] !== Object.prototype.toString && u["toString"] !== Array.prototype.toString) {
      return u["toString"]();
    }
  } catch {}
  return `Error: ${JSON.stringify(u)}`;
};
var spanSymbol = /* @__PURE__ */ Symbol.for("effect/SpanAnnotation");
var defaultRenderError = (error) => {
  const span2 = hasProperty(error, spanSymbol) && error[spanSymbol];
  if (error instanceof Error) {
    return new PrettyError(prettyErrorMessage(error), error.stack?.split(`
`).filter((_) => _.match(/at (.*)/)).join(`
`), span2);
  }
  return new PrettyError(prettyErrorMessage(error), undefined, span2);
};
var prettyErrors = (cause) => reduceWithContext(cause, undefined, {
  emptyCase: () => [],
  dieCase: (_, unknownError) => {
    return [defaultRenderError(unknownError)];
  },
  failCase: (_, error) => {
    return [defaultRenderError(error)];
  },
  interruptCase: () => [],
  parallelCase: (_, l, r) => [...l, ...r],
  sequentialCase: (_, l, r) => [...l, ...r]
});

// node_modules/effect/dist/esm/internal/opCodes/deferred.js
var OP_STATE_PENDING = "Pending";
var OP_STATE_DONE = "Done";

// node_modules/effect/dist/esm/internal/deferred.js
var DeferredSymbolKey = "effect/Deferred";
var DeferredTypeId = /* @__PURE__ */ Symbol.for(DeferredSymbolKey);
var deferredVariance = {
  _E: (_) => _,
  _A: (_) => _
};
var pending = (joiners) => {
  return {
    _tag: OP_STATE_PENDING,
    joiners
  };
};
var done = (effect) => {
  return {
    _tag: OP_STATE_DONE,
    effect
  };
};

// node_modules/effect/dist/esm/internal/tracer.js
var TracerTypeId = /* @__PURE__ */ Symbol.for("effect/Tracer");
var make16 = (options) => ({
  [TracerTypeId]: TracerTypeId,
  ...options
});
var tracerTag = /* @__PURE__ */ GenericTag("effect/Tracer");
var spanTag = /* @__PURE__ */ GenericTag("effect/ParentSpan");
var randomHexString = /* @__PURE__ */ function() {
  const characters = "abcdef0123456789";
  const charactersLength = characters.length;
  return function(length) {
    let result = "";
    for (let i = 0;i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  };
}();

class NativeSpan {
  name;
  parent;
  context;
  links;
  startTime;
  _tag = "Span";
  spanId;
  traceId = "native";
  sampled = true;
  status;
  attributes;
  events = [];
  constructor(name, parent, context, links, startTime) {
    this.name = name;
    this.parent = parent;
    this.context = context;
    this.links = links;
    this.startTime = startTime;
    this.status = {
      _tag: "Started",
      startTime
    };
    this.attributes = new Map;
    this.traceId = parent._tag === "Some" ? parent.value.traceId : randomHexString(32);
    this.spanId = randomHexString(16);
  }
  end(endTime, exit) {
    this.status = {
      _tag: "Ended",
      endTime,
      exit,
      startTime: this.status.startTime
    };
  }
  attribute(key, value) {
    this.attributes.set(key, value);
  }
  event(name, startTime, attributes) {
    this.events.push([name, startTime, attributes ?? {}]);
  }
}
var nativeTracer = /* @__PURE__ */ make16({
  span: (name, parent, context, links, startTime) => new NativeSpan(name, parent, context, links, startTime),
  context: (f) => f()
});

// node_modules/effect/dist/esm/internal/core.js
var EffectErrorSymbolKey = "effect/EffectError";
var EffectErrorTypeId = /* @__PURE__ */ Symbol.for(EffectErrorSymbolKey);
var isEffectError = (u) => hasProperty(u, EffectErrorTypeId);
var blocked = (blockedRequests, _continue) => {
  const effect = new EffectPrimitive("Blocked");
  effect.effect_instruction_i0 = blockedRequests;
  effect.effect_instruction_i1 = _continue;
  return effect;
};
var runRequestBlock = (blockedRequests) => {
  const effect = new EffectPrimitive("RunBlocked");
  effect.effect_instruction_i0 = blockedRequests;
  return effect;
};
var EffectTypeId2 = /* @__PURE__ */ Symbol.for("effect/Effect");

class RevertFlags {
  patch;
  op;
  _op = OP_REVERT_FLAGS;
  constructor(patch8, op) {
    this.patch = patch8;
    this.op = op;
  }
}

class EffectPrimitive {
  _op;
  effect_instruction_i0 = undefined;
  effect_instruction_i1 = undefined;
  effect_instruction_i2 = undefined;
  trace = undefined;
  [EffectTypeId2] = effectVariance;
  constructor(_op) {
    this._op = _op;
  }
  [symbol2](that) {
    return this === that;
  }
  [symbol]() {
    return cached(this, random(this));
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Effect",
      _op: this._op,
      effect_instruction_i0: toJSON(this.effect_instruction_i0),
      effect_instruction_i1: toJSON(this.effect_instruction_i1),
      effect_instruction_i2: toJSON(this.effect_instruction_i2)
    };
  }
  toString() {
    return format(this.toJSON());
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
}

class EffectPrimitiveFailure {
  _op;
  effect_instruction_i0 = undefined;
  effect_instruction_i1 = undefined;
  effect_instruction_i2 = undefined;
  trace = undefined;
  [EffectTypeId2] = effectVariance;
  constructor(_op) {
    this._op = _op;
    this._tag = _op;
  }
  [symbol2](that) {
    return this === that;
  }
  [symbol]() {
    return cached(this, random(this));
  }
  get cause() {
    return this.effect_instruction_i0;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Exit",
      _tag: this._op,
      cause: this.cause.toJSON()
    };
  }
  toString() {
    return format(this.toJSON());
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
}

class EffectPrimitiveSuccess {
  _op;
  effect_instruction_i0 = undefined;
  effect_instruction_i1 = undefined;
  effect_instruction_i2 = undefined;
  trace = undefined;
  [EffectTypeId2] = effectVariance;
  constructor(_op) {
    this._op = _op;
    this._tag = _op;
  }
  [symbol2](that) {
    return this === that;
  }
  [symbol]() {
    return cached(this, random(this));
  }
  get value() {
    return this.effect_instruction_i0;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Exit",
      _tag: this._op,
      value: toJSON(this.value)
    };
  }
  toString() {
    return format(this.toJSON());
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
}
var isEffect = (u) => hasProperty(u, EffectTypeId2);
var withFiberRuntime = (withRuntime) => {
  const effect = new EffectPrimitive(OP_WITH_RUNTIME);
  effect.effect_instruction_i0 = withRuntime;
  return effect;
};
var acquireUseRelease = /* @__PURE__ */ dual(3, (acquire, use, release) => uninterruptibleMask((restore) => flatMap7(acquire, (a) => flatMap7(exit(suspend(() => restore(use(a)))), (exit) => {
  return suspend(() => release(a, exit)).pipe(matchCauseEffect({
    onFailure: (cause) => {
      switch (exit._tag) {
        case OP_FAILURE:
          return failCause(parallel(exit.effect_instruction_i0, cause));
        case OP_SUCCESS:
          return failCause(cause);
      }
    },
    onSuccess: () => exit
  }));
}))));
var as = /* @__PURE__ */ dual(2, (self, value) => flatMap7(self, () => succeed(value)));
var asUnit = (self) => as(self, undefined);
var custom = function() {
  const wrapper = new EffectPrimitive(OP_COMMIT);
  switch (arguments.length) {
    case 2: {
      wrapper.effect_instruction_i0 = arguments[0];
      wrapper.commit = arguments[1];
      break;
    }
    case 3: {
      wrapper.effect_instruction_i0 = arguments[0];
      wrapper.effect_instruction_i1 = arguments[1];
      wrapper.commit = arguments[2];
      break;
    }
    case 4: {
      wrapper.effect_instruction_i0 = arguments[0];
      wrapper.effect_instruction_i1 = arguments[1];
      wrapper.effect_instruction_i2 = arguments[2];
      wrapper.commit = arguments[3];
      break;
    }
    default: {
      throw new Error(getBugErrorMessage("you're not supposed to end up here"));
    }
  }
  return wrapper;
};
var async = (register, blockingOn = none4) => {
  return custom(register, function() {
    let backingResume = undefined;
    let pendingEffect = undefined;
    function proxyResume(effect2) {
      if (backingResume) {
        backingResume(effect2);
      } else if (pendingEffect === undefined) {
        pendingEffect = effect2;
      }
    }
    const effect = new EffectPrimitive(OP_ASYNC);
    effect.effect_instruction_i0 = (resume) => {
      backingResume = resume;
      if (pendingEffect) {
        resume(pendingEffect);
      }
    };
    effect.effect_instruction_i1 = blockingOn;
    let cancelerRef = undefined;
    let controllerRef = undefined;
    if (this.effect_instruction_i0.length !== 1) {
      controllerRef = new AbortController;
      cancelerRef = this.effect_instruction_i0(proxyResume, controllerRef.signal);
    } else {
      cancelerRef = this.effect_instruction_i0(proxyResume);
    }
    return cancelerRef || controllerRef ? onInterrupt(effect, (_) => {
      if (controllerRef) {
        controllerRef.abort();
      }
      return cancelerRef ?? unit;
    }) : effect;
  });
};
var catchAllCause = /* @__PURE__ */ dual(2, (self, f) => {
  const effect = new EffectPrimitive(OP_ON_FAILURE);
  effect.effect_instruction_i0 = self;
  effect.effect_instruction_i1 = f;
  return effect;
});
var catchAll = /* @__PURE__ */ dual(2, (self, f) => matchEffect(self, {
  onFailure: f,
  onSuccess: succeed
}));
var spanSymbol2 = /* @__PURE__ */ Symbol.for("effect/SpanAnnotation");
var originalSymbol = /* @__PURE__ */ Symbol.for("effect/OriginalAnnotation");
var capture = (obj, span2) => {
  if (isSome2(span2)) {
    return new Proxy(obj, {
      has(target, p) {
        return p === spanSymbol2 || p === originalSymbol || p in target;
      },
      get(target, p) {
        if (p === spanSymbol2) {
          return span2.value;
        }
        if (p === originalSymbol) {
          return obj;
        }
        return target[p];
      }
    });
  }
  return obj;
};
var die2 = (defect) => isObject(defect) && !(spanSymbol2 in defect) ? withFiberRuntime((fiber) => failCause(die(capture(defect, currentSpanFromFiber(fiber))))) : failCause(die(defect));
var dieMessage = (message) => failCauseSync(() => die(new RuntimeException(message)));
var either2 = (self) => matchEffect(self, {
  onFailure: (e) => succeed(left2(e)),
  onSuccess: (a) => succeed(right2(a))
});
var exit = (self) => matchCause(self, {
  onFailure: exitFailCause,
  onSuccess: exitSucceed
});
var fail2 = (error) => isObject(error) && !(spanSymbol2 in error) ? withFiberRuntime((fiber) => failCause(fail(capture(error, currentSpanFromFiber(fiber))))) : failCause(fail(error));
var failSync = (evaluate) => flatMap7(sync(evaluate), fail2);
var failCause = (cause) => {
  const effect = new EffectPrimitiveFailure(OP_FAILURE);
  effect.effect_instruction_i0 = cause;
  return effect;
};
var failCauseSync = (evaluate) => flatMap7(sync(evaluate), failCause);
var fiberId = /* @__PURE__ */ withFiberRuntime((state) => succeed(state.id()));
var fiberIdWith = (f) => withFiberRuntime((state) => f(state.id()));
var flatMap7 = /* @__PURE__ */ dual(2, (self, f) => {
  const effect = new EffectPrimitive(OP_ON_SUCCESS);
  effect.effect_instruction_i0 = self;
  effect.effect_instruction_i1 = f;
  return effect;
});
var step2 = (self) => {
  const effect = new EffectPrimitive("OnStep");
  effect.effect_instruction_i0 = self;
  return effect;
};
var flatten3 = (self) => flatMap7(self, identity);
var matchCause = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onFailure: (cause) => succeed(options.onFailure(cause)),
  onSuccess: (a) => succeed(options.onSuccess(a))
}));
var matchCauseEffect = /* @__PURE__ */ dual(2, (self, options) => {
  const effect = new EffectPrimitive(OP_ON_SUCCESS_AND_FAILURE);
  effect.effect_instruction_i0 = self;
  effect.effect_instruction_i1 = options.onFailure;
  effect.effect_instruction_i2 = options.onSuccess;
  return effect;
});
var matchEffect = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onFailure: (cause) => {
    const defects2 = defects(cause);
    if (defects2.length > 0) {
      return failCause(electFailures(cause));
    }
    const failures2 = failures(cause);
    if (failures2.length > 0) {
      return options.onFailure(unsafeHead(failures2));
    }
    return failCause(cause);
  },
  onSuccess: options.onSuccess
}));
var forEachSequential = /* @__PURE__ */ dual(2, (self, f) => suspend(() => {
  const arr = fromIterable(self);
  const ret = new Array(arr.length);
  let i = 0;
  return as(whileLoop({
    while: () => i < arr.length,
    body: () => f(arr[i], i),
    step: (b) => {
      ret[i++] = b;
    }
  }), ret);
}));
var forEachSequentialDiscard = /* @__PURE__ */ dual(2, (self, f) => suspend(() => {
  const arr = fromIterable(self);
  let i = 0;
  return whileLoop({
    while: () => i < arr.length,
    body: () => f(arr[i], i),
    step: () => {
      i++;
    }
  });
}));
var interrupt2 = /* @__PURE__ */ flatMap7(fiberId, (fiberId2) => interruptWith(fiberId2));
var interruptWith = (fiberId2) => failCause(interrupt(fiberId2));
var interruptible2 = (self) => {
  const effect = new EffectPrimitive(OP_UPDATE_RUNTIME_FLAGS);
  effect.effect_instruction_i0 = enable3(Interruption);
  effect.effect_instruction_i1 = () => self;
  return effect;
};
var intoDeferred = /* @__PURE__ */ dual(2, (self, deferred) => uninterruptibleMask((restore) => flatMap7(exit(restore(self)), (exit2) => deferredDone(deferred, exit2))));
var map9 = /* @__PURE__ */ dual(2, (self, f) => flatMap7(self, (a) => sync(() => f(a))));
var mapBoth = /* @__PURE__ */ dual(2, (self, options) => matchEffect(self, {
  onFailure: (e) => failSync(() => options.onFailure(e)),
  onSuccess: (a) => sync(() => options.onSuccess(a))
}));
var mapError = /* @__PURE__ */ dual(2, (self, f) => matchCauseEffect(self, {
  onFailure: (cause) => {
    const either3 = failureOrCause(cause);
    switch (either3._tag) {
      case "Left": {
        return failSync(() => f(either3.left));
      }
      case "Right": {
        return failCause(either3.right);
      }
    }
  },
  onSuccess: succeed
}));
var onExit = /* @__PURE__ */ dual(2, (self, cleanup) => uninterruptibleMask((restore) => matchCauseEffect(restore(self), {
  onFailure: (cause1) => {
    const result = exitFailCause(cause1);
    return matchCauseEffect(cleanup(result), {
      onFailure: (cause2) => exitFailCause(sequential(cause1, cause2)),
      onSuccess: () => result
    });
  },
  onSuccess: (success) => {
    const result = exitSucceed(success);
    return zipRight(cleanup(result), result);
  }
})));
var onInterrupt = /* @__PURE__ */ dual(2, (self, cleanup) => onExit(self, exitMatch({
  onFailure: (cause) => isInterruptedOnly(cause) ? asUnit(cleanup(interruptors(cause))) : unit,
  onSuccess: () => unit
})));
var orDie = (self) => orDieWith(self, identity);
var orDieWith = /* @__PURE__ */ dual(2, (self, f) => matchEffect(self, {
  onFailure: (e) => die2(f(e)),
  onSuccess: succeed
}));
var succeed = (value) => {
  const effect = new EffectPrimitiveSuccess(OP_SUCCESS);
  effect.effect_instruction_i0 = value;
  return effect;
};
var suspend = (effect) => flatMap7(sync(effect), identity);
var sync = (evaluate) => {
  const effect = new EffectPrimitive(OP_SYNC);
  effect.effect_instruction_i0 = evaluate;
  return effect;
};
var tap = /* @__PURE__ */ dual(2, (self, f) => flatMap7(self, (a) => {
  const b = typeof f === "function" ? f(a) : f;
  if (isEffect(b)) {
    return as(b, a);
  } else if (isPromiseLike(b)) {
    return async((resume) => {
      b.then((_) => resume(succeed(a)), (e) => resume(fail2(new UnknownException(e))));
    });
  }
  return succeed(a);
}));
var transplant = (f) => withFiberRuntime((state) => {
  const scopeOverride = state.getFiberRef(currentForkScopeOverride);
  const scope = pipe(scopeOverride, getOrElse(() => state.scope()));
  return f(fiberRefLocally(currentForkScopeOverride, some2(scope)));
});
var uninterruptible = (self) => {
  const effect = new EffectPrimitive(OP_UPDATE_RUNTIME_FLAGS);
  effect.effect_instruction_i0 = disable2(Interruption);
  effect.effect_instruction_i1 = () => self;
  return effect;
};
var uninterruptibleMask = (f) => custom(f, function() {
  const effect = new EffectPrimitive(OP_UPDATE_RUNTIME_FLAGS);
  effect.effect_instruction_i0 = disable2(Interruption);
  effect.effect_instruction_i1 = (oldFlags) => interruption(oldFlags) ? this.effect_instruction_i0(interruptible2) : this.effect_instruction_i0(uninterruptible);
  return effect;
});
var unit = /* @__PURE__ */ succeed(undefined);
var updateRuntimeFlags = (patch8) => {
  const effect = new EffectPrimitive(OP_UPDATE_RUNTIME_FLAGS);
  effect.effect_instruction_i0 = patch8;
  effect.effect_instruction_i1 = undefined;
  return effect;
};
var whenEffect = /* @__PURE__ */ dual(2, (self, condition) => flatMap7(condition, (b) => {
  if (b) {
    return pipe(self, map9(some2));
  }
  return succeed(none2());
}));
var whileLoop = (options) => {
  const effect = new EffectPrimitive(OP_WHILE);
  effect.effect_instruction_i0 = options.while;
  effect.effect_instruction_i1 = options.body;
  effect.effect_instruction_i2 = options.step;
  return effect;
};
var withRuntimeFlags = /* @__PURE__ */ dual(2, (self, update2) => {
  const effect = new EffectPrimitive(OP_UPDATE_RUNTIME_FLAGS);
  effect.effect_instruction_i0 = update2;
  effect.effect_instruction_i1 = () => self;
  return effect;
});
var yieldNow = (options) => {
  const effect = new EffectPrimitive(OP_YIELD);
  return typeof options?.priority !== "undefined" ? withSchedulingPriority(effect, options.priority) : effect;
};
var zip2 = /* @__PURE__ */ dual(2, (self, that) => flatMap7(self, (a) => map9(that, (b) => [a, b])));
var zipLeft = /* @__PURE__ */ dual(2, (self, that) => flatMap7(self, (a) => as(that, a)));
var zipRight = /* @__PURE__ */ dual(2, (self, that) => flatMap7(self, () => that));
var zipWith2 = /* @__PURE__ */ dual(3, (self, that, f) => flatMap7(self, (a) => map9(that, (b) => f(a, b))));
var never = /* @__PURE__ */ async(() => {
  const interval = setInterval(() => {}, 2 ** 31 - 1);
  return sync(() => clearInterval(interval));
});
var interruptFiber = (self) => flatMap7(fiberId, (fiberId2) => pipe(self, interruptAsFiber(fiberId2)));
var interruptAsFiber = /* @__PURE__ */ dual(2, (self, fiberId2) => flatMap7(self.interruptAsFork(fiberId2), () => self.await));
var logLevelAll = {
  _tag: "All",
  syslog: 0,
  label: "ALL",
  ordinal: Number.MIN_SAFE_INTEGER,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var logLevelFatal = {
  _tag: "Fatal",
  syslog: 2,
  label: "FATAL",
  ordinal: 50000,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var logLevelError = {
  _tag: "Error",
  syslog: 3,
  label: "ERROR",
  ordinal: 40000,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var logLevelWarning = {
  _tag: "Warning",
  syslog: 4,
  label: "WARN",
  ordinal: 30000,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var logLevelInfo = {
  _tag: "Info",
  syslog: 6,
  label: "INFO",
  ordinal: 20000,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var logLevelDebug = {
  _tag: "Debug",
  syslog: 7,
  label: "DEBUG",
  ordinal: 1e4,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var logLevelTrace = {
  _tag: "Trace",
  syslog: 7,
  label: "TRACE",
  ordinal: 0,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var logLevelNone = {
  _tag: "None",
  syslog: 7,
  label: "OFF",
  ordinal: Number.MAX_SAFE_INTEGER,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var FiberRefSymbolKey = "effect/FiberRef";
var FiberRefTypeId = /* @__PURE__ */ Symbol.for(FiberRefSymbolKey);
var fiberRefVariance = {
  _A: (_) => _
};
var fiberRefGet = (self) => fiberRefModify(self, (a) => [a, a]);
var fiberRefGetWith = /* @__PURE__ */ dual(2, (self, f) => flatMap7(fiberRefGet(self), f));
var fiberRefSet = /* @__PURE__ */ dual(2, (self, value) => fiberRefModify(self, () => [undefined, value]));
var fiberRefModify = /* @__PURE__ */ dual(2, (self, f) => withFiberRuntime((state) => {
  const [b, a] = f(state.getFiberRef(self));
  state.setFiberRef(self, a);
  return succeed(b);
}));
var fiberRefLocally = /* @__PURE__ */ dual(3, (use, self, value) => acquireUseRelease(zipLeft(fiberRefGet(self), fiberRefSet(self, value)), () => use, (oldValue) => fiberRefSet(self, oldValue)));
var fiberRefLocallyWith = /* @__PURE__ */ dual(3, (use, self, f) => fiberRefGetWith(self, (a) => fiberRefLocally(use, self, f(a))));
var fiberRefUnsafeMake = (initial, options) => fiberRefUnsafeMakePatch(initial, {
  differ: update(),
  fork: options?.fork ?? identity,
  join: options?.join
});
var fiberRefUnsafeMakeHashSet = (initial) => {
  const differ2 = hashSet();
  return fiberRefUnsafeMakePatch(initial, {
    differ: differ2,
    fork: differ2.empty
  });
};
var fiberRefUnsafeMakeReadonlyArray = (initial) => {
  const differ2 = readonlyArray(update());
  return fiberRefUnsafeMakePatch(initial, {
    differ: differ2,
    fork: differ2.empty
  });
};
var fiberRefUnsafeMakeContext = (initial) => {
  const differ2 = environment();
  return fiberRefUnsafeMakePatch(initial, {
    differ: differ2,
    fork: differ2.empty
  });
};
var fiberRefUnsafeMakePatch = (initial, options) => ({
  [FiberRefTypeId]: fiberRefVariance,
  initial,
  diff: (oldValue, newValue) => options.differ.diff(oldValue, newValue),
  combine: (first, second) => options.differ.combine(first, second),
  patch: (patch8) => (oldValue) => options.differ.patch(patch8, oldValue),
  fork: options.fork,
  join: options.join ?? ((_, n) => n),
  pipe() {
    return pipeArguments(this, arguments);
  }
});
var fiberRefUnsafeMakeRuntimeFlags = (initial) => fiberRefUnsafeMakePatch(initial, {
  differ,
  fork: differ.empty
});
var currentContext = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentContext"), () => fiberRefUnsafeMakeContext(empty2()));
var currentSchedulingPriority = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentSchedulingPriority"), () => fiberRefUnsafeMake(0));
var currentMaxOpsBeforeYield = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentMaxOpsBeforeYield"), () => fiberRefUnsafeMake(2048));
var currentLogAnnotations = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentLogAnnotation"), () => fiberRefUnsafeMake(empty8()));
var currentLogLevel = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentLogLevel"), () => fiberRefUnsafeMake(logLevelInfo));
var currentLogSpan = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentLogSpan"), () => fiberRefUnsafeMake(empty9()));
var withSchedulingPriority = /* @__PURE__ */ dual(2, (self, scheduler) => fiberRefLocally(self, currentSchedulingPriority, scheduler));
var currentConcurrency = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentConcurrency"), () => fiberRefUnsafeMake("unbounded"));
var currentRequestBatching = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentRequestBatching"), () => fiberRefUnsafeMake(true));
var currentUnhandledErrorLogLevel = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentUnhandledErrorLogLevel"), () => fiberRefUnsafeMake(some2(logLevelDebug)));
var currentMetricLabels = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentMetricLabels"), () => fiberRefUnsafeMakeReadonlyArray(empty3()));
var currentForkScopeOverride = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentForkScopeOverride"), () => fiberRefUnsafeMake(none2(), {
  fork: () => none2(),
  join: (parent, _) => parent
}));
var currentInterruptedCause = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentInterruptedCause"), () => fiberRefUnsafeMake(empty17, {
  fork: () => empty17,
  join: (parent, _) => parent
}));
var ScopeTypeId = /* @__PURE__ */ Symbol.for("effect/Scope");
var CloseableScopeTypeId = /* @__PURE__ */ Symbol.for("effect/CloseableScope");
var scopeAddFinalizer = (self, finalizer) => self.addFinalizer(() => asUnit(finalizer));
var scopeAddFinalizerExit = (self, finalizer) => self.addFinalizer(finalizer);
var scopeClose = (self, exit2) => self.close(exit2);
var scopeFork = (self, strategy) => self.fork(strategy);
var YieldableError = /* @__PURE__ */ function() {
  class YieldableError2 extends globalThis.Error {
    commit() {
      return fail2(this);
    }
    toString() {
      return this.message ? `${this.name}: ${this.message}` : this.name;
    }
    toJSON() {
      return {
        ...this
      };
    }
    [NodeInspectSymbol]() {
      const stack = this.stack;
      if (stack) {
        return `${this.toString()}
${stack.split(`
`).slice(1).join(`
`)}`;
      }
      return this.toString();
    }
  }
  Object.assign(YieldableError2.prototype, StructuralCommitPrototype);
  return YieldableError2;
}();
var makeException = (proto2, tag) => {

  class Base extends YieldableError {
    _tag = tag;
  }
  Object.assign(Base.prototype, proto2);
  Base.prototype.name = tag;
  return Base;
};
var RuntimeExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Cause/errors/RuntimeException");
var RuntimeException = /* @__PURE__ */ makeException({
  [RuntimeExceptionTypeId]: RuntimeExceptionTypeId
}, "RuntimeException");
var InterruptedExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Cause/errors/InterruptedException");
var InterruptedException = /* @__PURE__ */ makeException({
  [InterruptedExceptionTypeId]: InterruptedExceptionTypeId
}, "InterruptedException");
var isInterruptedException = (u) => hasProperty(u, InterruptedExceptionTypeId);
var IllegalArgumentExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Cause/errors/IllegalArgument");
var IllegalArgumentException = /* @__PURE__ */ makeException({
  [IllegalArgumentExceptionTypeId]: IllegalArgumentExceptionTypeId
}, "IllegalArgumentException");
var NoSuchElementExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Cause/errors/NoSuchElement");
var NoSuchElementException = /* @__PURE__ */ makeException({
  [NoSuchElementExceptionTypeId]: NoSuchElementExceptionTypeId
}, "NoSuchElementException");
var InvalidPubSubCapacityExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Cause/errors/InvalidPubSubCapacityException");
var InvalidPubSubCapacityException = /* @__PURE__ */ makeException({
  [InvalidPubSubCapacityExceptionTypeId]: InvalidPubSubCapacityExceptionTypeId
}, "InvalidPubSubCapacityException");
var TimeoutExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Cause/errors/Timeout");
var TimeoutException = /* @__PURE__ */ makeException({
  [TimeoutExceptionTypeId]: TimeoutExceptionTypeId
}, "TimeoutException");
var UnknownExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Cause/errors/UnknownException");
var UnknownException = /* @__PURE__ */ function() {

  class UnknownException2 extends YieldableError {
    error;
    _tag = "UnknownException";
    constructor(error, message) {
      super(message ?? (hasProperty(error, "message") && isString(error.message) ? error.message : undefined));
      this.error = error;
    }
  }
  Object.assign(UnknownException2.prototype, {
    [UnknownExceptionTypeId]: UnknownExceptionTypeId,
    name: "UnknownException"
  });
  return UnknownException2;
}();
var exitIsFailure = (self) => self._tag === "Failure";
var exitIsSuccess = (self) => self._tag === "Success";
var exitAs = /* @__PURE__ */ dual(2, (self, value) => {
  switch (self._tag) {
    case OP_FAILURE: {
      return exitFailCause(self.effect_instruction_i0);
    }
    case OP_SUCCESS: {
      return exitSucceed(value);
    }
  }
});
var exitAsUnit = (self) => exitAs(self, undefined);
var exitCollectAll = (exits, options) => exitCollectAllInternal(exits, options?.parallel ? parallel : sequential);
var exitDie = (defect) => exitFailCause(die(defect));
var exitFail = (error) => exitFailCause(fail(error));
var exitFailCause = (cause) => {
  const effect = new EffectPrimitiveFailure(OP_FAILURE);
  effect.effect_instruction_i0 = cause;
  return effect;
};
var exitInterrupt = (fiberId2) => exitFailCause(interrupt(fiberId2));
var exitMap = /* @__PURE__ */ dual(2, (self, f) => {
  switch (self._tag) {
    case OP_FAILURE:
      return exitFailCause(self.effect_instruction_i0);
    case OP_SUCCESS:
      return exitSucceed(f(self.effect_instruction_i0));
  }
});
var exitMatch = /* @__PURE__ */ dual(2, (self, {
  onFailure,
  onSuccess
}) => {
  switch (self._tag) {
    case OP_FAILURE:
      return onFailure(self.effect_instruction_i0);
    case OP_SUCCESS:
      return onSuccess(self.effect_instruction_i0);
  }
});
var exitMatchEffect = /* @__PURE__ */ dual(2, (self, {
  onFailure,
  onSuccess
}) => {
  switch (self._tag) {
    case OP_FAILURE:
      return onFailure(self.effect_instruction_i0);
    case OP_SUCCESS:
      return onSuccess(self.effect_instruction_i0);
  }
});
var exitSucceed = (value) => {
  const effect = new EffectPrimitiveSuccess(OP_SUCCESS);
  effect.effect_instruction_i0 = value;
  return effect;
};
var exitUnit = /* @__PURE__ */ exitSucceed(undefined);
var exitZip = /* @__PURE__ */ dual(2, (self, that) => exitZipWith(self, that, {
  onSuccess: (a, a2) => [a, a2],
  onFailure: sequential
}));
var exitZipRight = /* @__PURE__ */ dual(2, (self, that) => exitZipWith(self, that, {
  onSuccess: (_, a2) => a2,
  onFailure: sequential
}));
var exitZipWith = /* @__PURE__ */ dual(3, (self, that, {
  onFailure,
  onSuccess
}) => {
  switch (self._tag) {
    case OP_FAILURE: {
      switch (that._tag) {
        case OP_SUCCESS:
          return exitFailCause(self.effect_instruction_i0);
        case OP_FAILURE: {
          return exitFailCause(onFailure(self.effect_instruction_i0, that.effect_instruction_i0));
        }
      }
    }
    case OP_SUCCESS: {
      switch (that._tag) {
        case OP_SUCCESS:
          return exitSucceed(onSuccess(self.effect_instruction_i0, that.effect_instruction_i0));
        case OP_FAILURE:
          return exitFailCause(that.effect_instruction_i0);
      }
    }
  }
});
var exitCollectAllInternal = (exits, combineCauses) => {
  const list = fromIterable2(exits);
  if (!isNonEmpty(list)) {
    return none2();
  }
  return pipe(tailNonEmpty2(list), reduce(pipe(headNonEmpty2(list), exitMap(of2)), (accumulator, current) => pipe(accumulator, exitZipWith(current, {
    onSuccess: (list2, value) => pipe(list2, prepend2(value)),
    onFailure: combineCauses
  }))), exitMap(reverse2), exitMap((chunk) => Array.from(chunk)), some2);
};
var deferredUnsafeMake = (fiberId2) => ({
  [DeferredTypeId]: deferredVariance,
  state: make9(pending([])),
  blockingOn: fiberId2,
  pipe() {
    return pipeArguments(this, arguments);
  }
});
var deferredMake = () => flatMap7(fiberId, (id) => deferredMakeAs(id));
var deferredMakeAs = (fiberId2) => sync(() => deferredUnsafeMake(fiberId2));
var deferredAwait = (self) => async((resume) => {
  const state = get6(self.state);
  switch (state._tag) {
    case OP_STATE_DONE: {
      return resume(state.effect);
    }
    case OP_STATE_PENDING: {
      state.joiners.push(resume);
      return deferredInterruptJoiner(self, resume);
    }
  }
}, self.blockingOn);
var deferredCompleteWith = /* @__PURE__ */ dual(2, (self, effect) => sync(() => {
  const state = get6(self.state);
  switch (state._tag) {
    case OP_STATE_DONE: {
      return false;
    }
    case OP_STATE_PENDING: {
      set2(self.state, done(effect));
      for (let i = 0, len = state.joiners.length;i < len; i++) {
        state.joiners[i](effect);
      }
      return true;
    }
  }
}));
var deferredDone = /* @__PURE__ */ dual(2, (self, exit2) => deferredCompleteWith(self, exit2));
var deferredFailCause = /* @__PURE__ */ dual(2, (self, cause) => deferredCompleteWith(self, failCause(cause)));
var deferredInterruptWith = /* @__PURE__ */ dual(2, (self, fiberId2) => deferredCompleteWith(self, interruptWith(fiberId2)));
var deferredIsDone = (self) => sync(() => get6(self.state)._tag === OP_STATE_DONE);
var deferredSucceed = /* @__PURE__ */ dual(2, (self, value) => deferredCompleteWith(self, succeed(value)));
var deferredUnsafeDone = (self, effect) => {
  const state = get6(self.state);
  if (state._tag === OP_STATE_PENDING) {
    set2(self.state, done(effect));
    for (let i = 0, len = state.joiners.length;i < len; i++) {
      state.joiners[i](effect);
    }
  }
};
var deferredInterruptJoiner = (self, joiner) => sync(() => {
  const state = get6(self.state);
  if (state._tag === OP_STATE_PENDING) {
    const index = state.joiners.indexOf(joiner);
    if (index >= 0) {
      state.joiners.splice(index, 1);
    }
  }
});
var constContext = /* @__PURE__ */ fiberRefGet(currentContext);
var context = () => constContext;
var contextWithEffect = (f) => flatMap7(context(), f);
var provideContext = /* @__PURE__ */ dual(2, (self, context2) => fiberRefLocally(currentContext, context2)(self));
var provideSomeContext = /* @__PURE__ */ dual(2, (self, context2) => fiberRefLocallyWith(currentContext, (parent) => merge2(parent, context2))(self));
var mapInputContext = /* @__PURE__ */ dual(2, (self, f) => contextWithEffect((context2) => provideContext(self, f(context2))));
var currentSpanFromFiber = (fiber) => {
  const span2 = fiber.getFiberRef(currentContext).unsafeMap.get(spanTag.key);
  return span2 !== undefined && span2._tag === "Span" ? some2(span2) : none2();
};

// node_modules/effect/dist/esm/Duration.js
var TypeId7 = /* @__PURE__ */ Symbol.for("effect/Duration");
var bigint0 = /* @__PURE__ */ BigInt(0);
var bigint24 = /* @__PURE__ */ BigInt(24);
var bigint60 = /* @__PURE__ */ BigInt(60);
var bigint1e3 = /* @__PURE__ */ BigInt(1000);
var bigint1e6 = /* @__PURE__ */ BigInt(1e6);
var bigint1e9 = /* @__PURE__ */ BigInt(1e9);
var DURATION_REGEX = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;
var decode = (input) => {
  if (isDuration(input)) {
    return input;
  } else if (isNumber(input)) {
    return millis(input);
  } else if (isBigInt(input)) {
    return nanos(input);
  } else if (Array.isArray(input)) {
    if (input.length === 2 && isNumber(input[0]) && isNumber(input[1])) {
      return nanos(BigInt(input[0]) * bigint1e9 + BigInt(input[1]));
    }
  } else if (isString(input)) {
    DURATION_REGEX.lastIndex = 0;
    const match4 = DURATION_REGEX.exec(input);
    if (match4) {
      const [_, valueStr, unit2] = match4;
      const value = Number(valueStr);
      switch (unit2) {
        case "nano":
        case "nanos":
          return nanos(BigInt(valueStr));
        case "micro":
        case "micros":
          return micros(BigInt(valueStr));
        case "milli":
        case "millis":
          return millis(value);
        case "second":
        case "seconds":
          return seconds(value);
        case "minute":
        case "minutes":
          return minutes(value);
        case "hour":
        case "hours":
          return hours(value);
        case "day":
        case "days":
          return days(value);
        case "week":
        case "weeks":
          return weeks(value);
      }
    }
  }
  throw new Error("Invalid DurationInput");
};
var decodeUnknown = /* @__PURE__ */ liftThrowable(decode);
var zeroValue = {
  _tag: "Millis",
  millis: 0
};
var infinityValue = {
  _tag: "Infinity"
};
var DurationProto = {
  [TypeId7]: TypeId7,
  [symbol]() {
    return cached(this, structure(this.value));
  },
  [symbol2](that) {
    return isDuration(that) && equals2(this, that);
  },
  toString() {
    return `Duration(${format2(this)})`;
  },
  toJSON() {
    switch (this.value._tag) {
      case "Millis":
        return {
          _id: "Duration",
          _tag: "Millis",
          millis: this.value.millis
        };
      case "Nanos":
        return {
          _id: "Duration",
          _tag: "Nanos",
          hrtime: toHrTime(this)
        };
      case "Infinity":
        return {
          _id: "Duration",
          _tag: "Infinity"
        };
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var make18 = (input) => {
  const duration = Object.create(DurationProto);
  if (isNumber(input)) {
    if (isNaN(input) || input <= 0) {
      duration.value = zeroValue;
    } else if (!Number.isFinite(input)) {
      duration.value = infinityValue;
    } else if (!Number.isInteger(input)) {
      duration.value = {
        _tag: "Nanos",
        nanos: BigInt(Math.round(input * 1e6))
      };
    } else {
      duration.value = {
        _tag: "Millis",
        millis: input
      };
    }
  } else if (input <= bigint0) {
    duration.value = zeroValue;
  } else {
    duration.value = {
      _tag: "Nanos",
      nanos: input
    };
  }
  return duration;
};
var isDuration = (u) => hasProperty(u, TypeId7);
var zero = /* @__PURE__ */ make18(0);
var nanos = (nanos2) => make18(nanos2);
var micros = (micros2) => make18(micros2 * bigint1e3);
var millis = (millis2) => make18(millis2);
var seconds = (seconds2) => make18(seconds2 * 1000);
var minutes = (minutes2) => make18(minutes2 * 60000);
var hours = (hours2) => make18(hours2 * 3600000);
var days = (days2) => make18(days2 * 86400000);
var weeks = (weeks2) => make18(weeks2 * 604800000);
var toMillis = (self) => {
  const _self = decode(self);
  switch (_self.value._tag) {
    case "Infinity":
      return Infinity;
    case "Nanos":
      return Number(_self.value.nanos) / 1e6;
    case "Millis":
      return _self.value.millis;
  }
};
var unsafeToNanos = (self) => {
  const _self = decode(self);
  switch (_self.value._tag) {
    case "Infinity":
      throw new Error("Cannot convert infinite duration to nanos");
    case "Nanos":
      return _self.value.nanos;
    case "Millis":
      return BigInt(Math.round(_self.value.millis * 1e6));
  }
};
var toHrTime = (self) => {
  const _self = decode(self);
  switch (_self.value._tag) {
    case "Infinity":
      return [Infinity, 0];
    case "Nanos":
      return [Number(_self.value.nanos / bigint1e9), Number(_self.value.nanos % bigint1e9)];
    case "Millis":
      return [Math.floor(_self.value.millis / 1000), Math.round(_self.value.millis % 1000 * 1e6)];
  }
};
var match4 = /* @__PURE__ */ dual(2, (self, options) => {
  const _self = decode(self);
  switch (_self.value._tag) {
    case "Nanos":
      return options.onNanos(_self.value.nanos);
    case "Infinity":
      return options.onMillis(Infinity);
    case "Millis":
      return options.onMillis(_self.value.millis);
  }
});
var matchWith = /* @__PURE__ */ dual(3, (self, that, options) => {
  const _self = decode(self);
  const _that = decode(that);
  if (_self.value._tag === "Infinity" || _that.value._tag === "Infinity") {
    return options.onMillis(toMillis(_self), toMillis(_that));
  } else if (_self.value._tag === "Nanos" || _that.value._tag === "Nanos") {
    const selfNanos = _self.value._tag === "Nanos" ? _self.value.nanos : BigInt(Math.round(_self.value.millis * 1e6));
    const thatNanos = _that.value._tag === "Nanos" ? _that.value.nanos : BigInt(Math.round(_that.value.millis * 1e6));
    return options.onNanos(selfNanos, thatNanos);
  }
  return options.onMillis(_self.value.millis, _that.value.millis);
});
var Equivalence = (self, that) => matchWith(self, that, {
  onMillis: (self2, that2) => self2 === that2,
  onNanos: (self2, that2) => self2 === that2
});
var times = /* @__PURE__ */ dual(2, (self, times2) => match4(self, {
  onMillis: (millis2) => make18(millis2 * times2),
  onNanos: (nanos2) => make18(nanos2 * BigInt(times2))
}));
var sum = /* @__PURE__ */ dual(2, (self, that) => matchWith(self, that, {
  onMillis: (self2, that2) => make18(self2 + that2),
  onNanos: (self2, that2) => make18(self2 + that2)
}));
var greaterThanOrEqualTo = /* @__PURE__ */ dual(2, (self, that) => matchWith(self, that, {
  onMillis: (self2, that2) => self2 >= that2,
  onNanos: (self2, that2) => self2 >= that2
}));
var equals2 = /* @__PURE__ */ dual(2, (self, that) => Equivalence(decode(self), decode(that)));
var format2 = (self) => {
  const duration = decode(self);
  const parts = [];
  if (duration.value._tag === "Infinity") {
    return "Infinity";
  }
  const nanos2 = unsafeToNanos(duration);
  if (nanos2 % bigint1e6) {
    parts.push(`${nanos2 % bigint1e6}ns`);
  }
  const ms = nanos2 / bigint1e6;
  if (ms % bigint1e3 !== bigint0) {
    parts.push(`${ms % bigint1e3}ms`);
  }
  const sec = ms / bigint1e3;
  if (sec % bigint60 !== bigint0) {
    parts.push(`${sec % bigint60}s`);
  }
  const min2 = sec / bigint60;
  if (min2 % bigint60 !== bigint0) {
    parts.push(`${min2 % bigint60}m`);
  }
  const hr = min2 / bigint60;
  if (hr % bigint24 !== bigint0) {
    parts.push(`${hr % bigint24}h`);
  }
  const days2 = hr / bigint24;
  if (days2 !== bigint0) {
    parts.push(`${days2}d`);
  }
  return parts.reverse().join(" ");
};

// node_modules/effect/dist/esm/internal/clock.js
var ClockSymbolKey = "effect/Clock";
var ClockTypeId = /* @__PURE__ */ Symbol.for(ClockSymbolKey);
var clockTag = /* @__PURE__ */ GenericTag("effect/Clock");
var MAX_TIMER_MILLIS = 2 ** 31 - 1;
var globalClockScheduler = {
  unsafeSchedule(task, duration) {
    const millis2 = toMillis(duration);
    if (millis2 > MAX_TIMER_MILLIS) {
      return constFalse;
    }
    let completed = false;
    const handle = setTimeout(() => {
      completed = true;
      task();
    }, millis2);
    return () => {
      clearTimeout(handle);
      return !completed;
    };
  }
};
var performanceNowNanos = /* @__PURE__ */ function() {
  const bigint1e62 = /* @__PURE__ */ BigInt(1e6);
  if (typeof performance === "undefined") {
    return () => BigInt(Date.now()) * bigint1e62;
  }
  const origin = "timeOrigin" in performance && typeof performance.timeOrigin === "number" ? /* @__PURE__ */ BigInt(/* @__PURE__ */ Math.round(performance.timeOrigin * 1e6)) : /* @__PURE__ */ BigInt(/* @__PURE__ */ Date.now()) * bigint1e62 - /* @__PURE__ */ BigInt(/* @__PURE__ */ Math.round(/* @__PURE__ */ performance.now() * 1e6));
  return () => origin + BigInt(Math.round(performance.now() * 1e6));
}();
var processOrPerformanceNow = /* @__PURE__ */ function() {
  const processHrtime = typeof process === "object" && "hrtime" in process && typeof process.hrtime.bigint === "function" ? process.hrtime : undefined;
  if (!processHrtime) {
    return performanceNowNanos;
  }
  const origin = /* @__PURE__ */ performanceNowNanos() - /* @__PURE__ */ processHrtime.bigint();
  return () => origin + processHrtime.bigint();
}();

class ClockImpl {
  [ClockTypeId] = ClockTypeId;
  unsafeCurrentTimeMillis() {
    return Date.now();
  }
  unsafeCurrentTimeNanos() {
    return processOrPerformanceNow();
  }
  currentTimeMillis = sync(() => this.unsafeCurrentTimeMillis());
  currentTimeNanos = sync(() => this.unsafeCurrentTimeNanos());
  scheduler() {
    return succeed(globalClockScheduler);
  }
  sleep(duration) {
    return async((resume) => {
      const canceler = globalClockScheduler.unsafeSchedule(() => resume(unit), duration);
      return asUnit(sync(canceler));
    });
  }
}
var make19 = () => new ClockImpl;

// node_modules/effect/dist/esm/Number.js
var Order = number3;

// node_modules/effect/dist/esm/RegExp.js
var escape = (string2) => string2.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");

// node_modules/effect/dist/esm/internal/opCodes/configError.js
var OP_AND = "And";
var OP_OR = "Or";
var OP_INVALID_DATA = "InvalidData";
var OP_MISSING_DATA = "MissingData";
var OP_SOURCE_UNAVAILABLE = "SourceUnavailable";
var OP_UNSUPPORTED = "Unsupported";

// node_modules/effect/dist/esm/internal/configError.js
var ConfigErrorSymbolKey = "effect/ConfigError";
var ConfigErrorTypeId = /* @__PURE__ */ Symbol.for(ConfigErrorSymbolKey);
var proto2 = {
  [ConfigErrorTypeId]: ConfigErrorTypeId
};
var And = (self, that) => {
  const error = Object.create(proto2);
  error._tag = OP_AND;
  error.left = self;
  error.right = that;
  Object.defineProperty(error, "toString", {
    enumerable: false,
    value() {
      return `${this.left} and ${this.right}`;
    }
  });
  return error;
};
var Or = (self, that) => {
  const error = Object.create(proto2);
  error._tag = OP_OR;
  error.left = self;
  error.right = that;
  Object.defineProperty(error, "toString", {
    enumerable: false,
    value() {
      return `${this.left} or ${this.right}`;
    }
  });
  return error;
};
var InvalidData = (path, message, options = {
  pathDelim: "."
}) => {
  const error = Object.create(proto2);
  error._tag = OP_INVALID_DATA;
  error.path = path;
  error.message = message;
  Object.defineProperty(error, "toString", {
    enumerable: false,
    value() {
      const path2 = pipe(this.path, join(options.pathDelim));
      return `(Invalid data at ${path2}: "${this.message}")`;
    }
  });
  return error;
};
var MissingData = (path, message, options = {
  pathDelim: "."
}) => {
  const error = Object.create(proto2);
  error._tag = OP_MISSING_DATA;
  error.path = path;
  error.message = message;
  Object.defineProperty(error, "toString", {
    enumerable: false,
    value() {
      const path2 = pipe(this.path, join(options.pathDelim));
      return `(Missing data at ${path2}: "${this.message}")`;
    }
  });
  return error;
};
var SourceUnavailable = (path, message, cause, options = {
  pathDelim: "."
}) => {
  const error = Object.create(proto2);
  error._tag = OP_SOURCE_UNAVAILABLE;
  error.path = path;
  error.message = message;
  error.cause = cause;
  Object.defineProperty(error, "toString", {
    enumerable: false,
    value() {
      const path2 = pipe(this.path, join(options.pathDelim));
      return `(Source unavailable at ${path2}: "${this.message}")`;
    }
  });
  return error;
};
var Unsupported = (path, message, options = {
  pathDelim: "."
}) => {
  const error = Object.create(proto2);
  error._tag = OP_UNSUPPORTED;
  error.path = path;
  error.message = message;
  Object.defineProperty(error, "toString", {
    enumerable: false,
    value() {
      const path2 = pipe(this.path, join(options.pathDelim));
      return `(Unsupported operation at ${path2}: "${this.message}")`;
    }
  });
  return error;
};
var prefixed = /* @__PURE__ */ dual(2, (self, prefix) => {
  switch (self._tag) {
    case OP_AND: {
      return And(prefixed(self.left, prefix), prefixed(self.right, prefix));
    }
    case OP_OR: {
      return Or(prefixed(self.left, prefix), prefixed(self.right, prefix));
    }
    case OP_INVALID_DATA: {
      return InvalidData([...prefix, ...self.path], self.message);
    }
    case OP_MISSING_DATA: {
      return MissingData([...prefix, ...self.path], self.message);
    }
    case OP_SOURCE_UNAVAILABLE: {
      return SourceUnavailable([...prefix, ...self.path], self.message, self.cause);
    }
    case OP_UNSUPPORTED: {
      return Unsupported([...prefix, ...self.path], self.message);
    }
  }
});

// node_modules/effect/dist/esm/internal/configProvider/pathPatch.js
var empty19 = {
  _tag: "Empty"
};
var patch8 = /* @__PURE__ */ dual(2, (path, patch9) => {
  let input = of3(patch9);
  let output = path;
  while (isCons(input)) {
    const patch10 = input.head;
    switch (patch10._tag) {
      case "Empty": {
        input = input.tail;
        break;
      }
      case "AndThen": {
        input = cons(patch10.first, cons(patch10.second, input.tail));
        break;
      }
      case "MapName": {
        output = map2(output, patch10.f);
        input = input.tail;
        break;
      }
      case "Nested": {
        output = prepend(output, patch10.name);
        input = input.tail;
        break;
      }
      case "Unnested": {
        const containsName = pipe(head(output), contains(patch10.name));
        if (containsName) {
          output = tailNonEmpty(output);
          input = input.tail;
        } else {
          return left2(MissingData(output, `Expected ${patch10.name} to be in path in ConfigProvider#unnested`));
        }
        break;
      }
    }
  }
  return right2(output);
});

// node_modules/effect/dist/esm/internal/opCodes/config.js
var OP_CONSTANT = "Constant";
var OP_FAIL2 = "Fail";
var OP_FALLBACK = "Fallback";
var OP_DESCRIBED = "Described";
var OP_LAZY = "Lazy";
var OP_MAP_OR_FAIL = "MapOrFail";
var OP_NESTED = "Nested";
var OP_PRIMITIVE = "Primitive";
var OP_SEQUENCE = "Sequence";
var OP_HASHMAP = "HashMap";
var OP_ZIP_WITH = "ZipWith";

// node_modules/effect/dist/esm/internal/configProvider.js
var concat = (l, r) => [...l, ...r];
var ConfigProviderSymbolKey = "effect/ConfigProvider";
var ConfigProviderTypeId = /* @__PURE__ */ Symbol.for(ConfigProviderSymbolKey);
var configProviderTag = /* @__PURE__ */ GenericTag("effect/ConfigProvider");
var FlatConfigProviderSymbolKey = "effect/ConfigProviderFlat";
var FlatConfigProviderTypeId = /* @__PURE__ */ Symbol.for(FlatConfigProviderSymbolKey);
var make21 = (options) => ({
  [ConfigProviderTypeId]: ConfigProviderTypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
  ...options
});
var makeFlat = (options) => ({
  [FlatConfigProviderTypeId]: FlatConfigProviderTypeId,
  patch: options.patch,
  load: (path, config, split = true) => options.load(path, config, split),
  enumerateChildren: options.enumerateChildren
});
var fromFlat = (flat) => make21({
  load: (config) => flatMap7(fromFlatLoop(flat, empty3(), config, false), (chunk) => match(head(chunk), {
    onNone: () => fail2(MissingData(empty3(), `Expected a single value having structure: ${config}`)),
    onSome: succeed
  })),
  flattened: flat
});
var fromEnv = (config) => {
  const {
    pathDelim,
    seqDelim
  } = Object.assign({}, {
    pathDelim: "_",
    seqDelim: ","
  }, config);
  const makePathString = (path) => pipe(path, join(pathDelim));
  const unmakePathString = (pathString) => pathString.split(pathDelim);
  const getEnv = () => typeof process !== "undefined" && ("env" in process) && typeof process.env === "object" ? process.env : {};
  const load = (path, primitive, split = true) => {
    const pathString = makePathString(path);
    const current = getEnv();
    const valueOpt = pathString in current ? some2(current[pathString]) : none2();
    return pipe(valueOpt, mapError(() => MissingData(path, `Expected ${pathString} to exist in the process context`)), flatMap7((value) => parsePrimitive(value, path, primitive, seqDelim, split)));
  };
  const enumerateChildren = (path) => sync(() => {
    const current = getEnv();
    const keys3 = Object.keys(current);
    const keyPaths = Array.from(keys3).map((value) => unmakePathString(value.toUpperCase()));
    const filteredKeyPaths = keyPaths.filter((keyPath) => {
      for (let i = 0;i < path.length; i++) {
        const pathComponent = pipe(path, unsafeGet3(i));
        const currentElement = keyPath[i];
        if (currentElement === undefined || pathComponent !== currentElement) {
          return false;
        }
      }
      return true;
    }).flatMap((keyPath) => keyPath.slice(path.length, path.length + 1));
    return fromIterable5(filteredKeyPaths);
  });
  return fromFlat(makeFlat({
    load,
    enumerateChildren,
    patch: empty19
  }));
};
var extend = (leftDef, rightDef, left3, right3) => {
  const leftPad = unfold(left3.length, (index) => index >= right3.length ? none2() : some2([leftDef(index), index + 1]));
  const rightPad = unfold(right3.length, (index) => index >= left3.length ? none2() : some2([rightDef(index), index + 1]));
  const leftExtension = concat(left3, leftPad);
  const rightExtension = concat(right3, rightPad);
  return [leftExtension, rightExtension];
};
var appendConfigPath = (path, config) => {
  let op = config;
  if (op._tag === "Nested") {
    const out = path.slice();
    while (op._tag === "Nested") {
      out.push(op.name);
      op = op.config;
    }
    return out;
  }
  return path;
};
var fromFlatLoop = (flat, prefix, config, split) => {
  const op = config;
  switch (op._tag) {
    case OP_CONSTANT: {
      return succeed(of(op.value));
    }
    case OP_DESCRIBED: {
      return suspend(() => fromFlatLoop(flat, prefix, op.config, split));
    }
    case OP_FAIL2: {
      return fail2(MissingData(prefix, op.message));
    }
    case OP_FALLBACK: {
      return pipe(suspend(() => fromFlatLoop(flat, prefix, op.first, split)), catchAll((error1) => {
        if (op.condition(error1)) {
          return pipe(fromFlatLoop(flat, prefix, op.second, split), catchAll((error2) => fail2(Or(error1, error2))));
        }
        return fail2(error1);
      }));
    }
    case OP_LAZY: {
      return suspend(() => fromFlatLoop(flat, prefix, op.config(), split));
    }
    case OP_MAP_OR_FAIL: {
      return suspend(() => pipe(fromFlatLoop(flat, prefix, op.original, split), flatMap7(forEachSequential((a) => pipe(op.mapOrFail(a), mapError(prefixed(appendConfigPath(prefix, op.original))))))));
    }
    case OP_NESTED: {
      return suspend(() => fromFlatLoop(flat, concat(prefix, of(op.name)), op.config, split));
    }
    case OP_PRIMITIVE: {
      return pipe(patch8(prefix, flat.patch), flatMap7((prefix2) => pipe(flat.load(prefix2, op, split), flatMap7((values3) => {
        if (values3.length === 0) {
          const name = pipe(last(prefix2), getOrElse(() => "<n/a>"));
          return fail2(MissingData([], `Expected ${op.description} with name ${name}`));
        }
        return succeed(values3);
      }))));
    }
    case OP_SEQUENCE: {
      return pipe(patch8(prefix, flat.patch), flatMap7((patchedPrefix) => pipe(flat.enumerateChildren(patchedPrefix), flatMap7(indicesFrom), flatMap7((indices) => {
        if (indices.length === 0) {
          return suspend(() => map9(fromFlatLoop(flat, patchedPrefix, op.config, true), of));
        }
        return pipe(forEachSequential(indices, (index) => fromFlatLoop(flat, append(prefix, `[${index}]`), op.config, true)), map9((chunkChunk) => {
          const flattened = flatten(chunkChunk);
          if (flattened.length === 0) {
            return of(empty3());
          }
          return of(flattened);
        }));
      }))));
    }
    case OP_HASHMAP: {
      return suspend(() => pipe(patch8(prefix, flat.patch), flatMap7((prefix2) => pipe(flat.enumerateChildren(prefix2), flatMap7((keys3) => {
        return pipe(keys3, forEachSequential((key) => fromFlatLoop(flat, concat(prefix2, of(key)), op.valueConfig, split)), map9((values3) => {
          if (values3.length === 0) {
            return of(empty8());
          }
          const matrix = values3.map((x) => Array.from(x));
          return pipe(transpose(matrix), map2((values4) => fromIterable6(zip(fromIterable(keys3), values4))));
        }));
      })))));
    }
    case OP_ZIP_WITH: {
      return suspend(() => pipe(fromFlatLoop(flat, prefix, op.left, split), either2, flatMap7((left3) => pipe(fromFlatLoop(flat, prefix, op.right, split), either2, flatMap7((right3) => {
        if (isLeft2(left3) && isLeft2(right3)) {
          return fail2(And(left3.left, right3.left));
        }
        if (isLeft2(left3) && isRight2(right3)) {
          return fail2(left3.left);
        }
        if (isRight2(left3) && isLeft2(right3)) {
          return fail2(right3.left);
        }
        if (isRight2(left3) && isRight2(right3)) {
          const path = pipe(prefix, join("."));
          const fail3 = fromFlatLoopFail(prefix, path);
          const [lefts, rights] = extend(fail3, fail3, pipe(left3.right, map2(right2)), pipe(right3.right, map2(right2)));
          return pipe(lefts, zip(rights), forEachSequential(([left4, right4]) => pipe(zip2(left4, right4), map9(([left5, right5]) => op.zip(left5, right5)))));
        }
        throw new Error("BUG: ConfigProvider.fromFlatLoop - please report an issue at https://github.com/Effect-TS/effect/issues");
      })))));
    }
  }
};
var fromFlatLoopFail = (prefix, path) => (index) => left2(MissingData(prefix, `The element at index ${index} in a sequence at path "${path}" was missing`));
var splitPathString = (text, delim) => {
  const split = text.split(new RegExp(`\\s*${escape(delim)}\\s*`));
  return split;
};
var parsePrimitive = (text, path, primitive, delimiter, split) => {
  if (!split) {
    return pipe(primitive.parse(text), mapBoth({
      onFailure: prefixed(path),
      onSuccess: of
    }));
  }
  return pipe(splitPathString(text, delimiter), forEachSequential((char) => primitive.parse(char.trim())), mapError(prefixed(path)));
};
var transpose = (array4) => {
  return Object.keys(array4[0]).map((column) => array4.map((row) => row[column]));
};
var indicesFrom = (quotedIndices) => pipe(forEachSequential(quotedIndices, parseQuotedIndex), mapBoth({
  onFailure: () => empty3(),
  onSuccess: sort(Order)
}), either2, map9(merge3));
var QUOTED_INDEX_REGEX = /^(\[(\d+)\])$/;
var parseQuotedIndex = (str) => {
  const match6 = str.match(QUOTED_INDEX_REGEX);
  if (match6 !== null) {
    const matchedIndex = match6[2];
    return pipe(matchedIndex !== undefined && matchedIndex.length > 0 ? some2(matchedIndex) : none2(), flatMap(parseInteger));
  }
  return none2();
};
var parseInteger = (str) => {
  const parsedIndex = Number.parseInt(str);
  return Number.isNaN(parsedIndex) ? none2() : some2(parsedIndex);
};

// node_modules/effect/dist/esm/internal/defaultServices/console.js
var TypeId8 = /* @__PURE__ */ Symbol.for("effect/Console");
var consoleTag = /* @__PURE__ */ GenericTag("effect/Console");
var defaultConsole = {
  [TypeId8]: TypeId8,
  assert(condition, ...args) {
    return sync(() => {
      console.assert(condition, ...args);
    });
  },
  clear: /* @__PURE__ */ sync(() => {
    console.clear();
  }),
  count(label) {
    return sync(() => {
      console.count(label);
    });
  },
  countReset(label) {
    return sync(() => {
      console.countReset(label);
    });
  },
  debug(...args) {
    return sync(() => {
      console.debug(...args);
    });
  },
  dir(item, options) {
    return sync(() => {
      console.dir(item, options);
    });
  },
  dirxml(...args) {
    return sync(() => {
      console.dirxml(...args);
    });
  },
  error(...args) {
    return sync(() => {
      console.error(...args);
    });
  },
  group(options) {
    return options?.collapsed ? sync(() => console.groupCollapsed(options?.label)) : sync(() => console.group(options?.label));
  },
  groupEnd: /* @__PURE__ */ sync(() => {
    console.groupEnd();
  }),
  info(...args) {
    return sync(() => {
      console.info(...args);
    });
  },
  log(...args) {
    return sync(() => {
      console.log(...args);
    });
  },
  table(tabularData, properties) {
    return sync(() => {
      console.table(tabularData, properties);
    });
  },
  time(label) {
    return sync(() => console.time(label));
  },
  timeEnd(label) {
    return sync(() => console.timeEnd(label));
  },
  timeLog(label, ...args) {
    return sync(() => {
      console.timeLog(label, ...args);
    });
  },
  trace(...args) {
    return sync(() => {
      console.trace(...args);
    });
  },
  warn(...args) {
    return sync(() => {
      console.warn(...args);
    });
  },
  unsafe: console
};

// node_modules/effect/dist/esm/internal/random.js
var RandomSymbolKey = "effect/Random";
var RandomTypeId = /* @__PURE__ */ Symbol.for(RandomSymbolKey);
var randomTag = /* @__PURE__ */ GenericTag("effect/Random");

class RandomImpl {
  seed;
  [RandomTypeId] = RandomTypeId;
  PRNG;
  constructor(seed) {
    this.seed = seed;
    this.PRNG = new PCGRandom(seed);
  }
  get next() {
    return sync(() => this.PRNG.number());
  }
  get nextBoolean() {
    return map9(this.next, (n) => n > 0.5);
  }
  get nextInt() {
    return sync(() => this.PRNG.integer(Number.MAX_SAFE_INTEGER));
  }
  nextRange(min2, max2) {
    return map9(this.next, (n) => (max2 - min2) * n + min2);
  }
  nextIntBetween(min2, max2) {
    return sync(() => this.PRNG.integer(max2 - min2) + min2);
  }
  shuffle(elements) {
    return shuffleWith(elements, (n) => this.nextIntBetween(0, n));
  }
}
var shuffleWith = (elements, nextIntBounded) => {
  return suspend(() => pipe(sync(() => Array.from(elements)), flatMap7((buffer) => {
    const numbers = [];
    for (let i = buffer.length;i >= 2; i = i - 1) {
      numbers.push(i);
    }
    return pipe(numbers, forEachSequentialDiscard((n) => pipe(nextIntBounded(n), map9((k) => swap(buffer, n - 1, k)))), as(fromIterable2(buffer)));
  })));
};
var swap = (buffer, index1, index2) => {
  const tmp = buffer[index1];
  buffer[index1] = buffer[index2];
  buffer[index2] = tmp;
  return buffer;
};
var make22 = (seed) => new RandomImpl(seed);

// node_modules/effect/dist/esm/internal/defaultServices.js
var liveServices = /* @__PURE__ */ pipe(/* @__PURE__ */ empty2(), /* @__PURE__ */ add2(clockTag, /* @__PURE__ */ make19()), /* @__PURE__ */ add2(consoleTag, defaultConsole), /* @__PURE__ */ add2(randomTag, /* @__PURE__ */ make22(/* @__PURE__ */ Math.random() * 4294967296 >>> 0)), /* @__PURE__ */ add2(configProviderTag, /* @__PURE__ */ fromEnv()), /* @__PURE__ */ add2(tracerTag, nativeTracer));
var currentServices = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/DefaultServices/currentServices"), () => fiberRefUnsafeMakeContext(liveServices));
var sleep = (duration) => {
  const decodedDuration = decode(duration);
  return clockWith((clock) => clock.sleep(decodedDuration));
};
var clockWith = (f) => fiberRefGetWith(currentServices, (services) => f(get2(services, clockTag)));
var currentTimeMillis = /* @__PURE__ */ clockWith((clock) => clock.currentTimeMillis);
var configProviderWith = (f) => fiberRefGetWith(currentServices, (services) => f(get2(services, configProviderTag)));
var config = (config2) => configProviderWith((_) => _.load(config2));

// node_modules/effect/dist/esm/Deferred.js
var make23 = deferredMake;
var _await = deferredAwait;
var failCause2 = deferredFailCause;
var isDone = deferredIsDone;
var succeed2 = deferredSucceed;

// node_modules/effect/dist/esm/Effectable.js
var EffectTypeId3 = EffectTypeId;

// node_modules/effect/dist/esm/internal/executionStrategy.js
var OP_SEQUENTIAL2 = "Sequential";
var OP_PARALLEL2 = "Parallel";
var OP_PARALLEL_N = "ParallelN";
var sequential2 = {
  _tag: OP_SEQUENTIAL2
};
var parallel2 = {
  _tag: OP_PARALLEL2
};
var parallelN = (parallelism) => ({
  _tag: OP_PARALLEL_N,
  parallelism
});
var isSequential = (self) => self._tag === OP_SEQUENTIAL2;
var isParallel = (self) => self._tag === OP_PARALLEL2;

// node_modules/effect/dist/esm/ExecutionStrategy.js
var sequential3 = sequential2;
var parallel3 = parallel2;
var parallelN2 = parallelN;

// node_modules/effect/dist/esm/internal/fiberRefs.js
function unsafeMake3(fiberRefLocals) {
  return new FiberRefsImpl(fiberRefLocals);
}
function empty20() {
  return unsafeMake3(new Map);
}
var FiberRefsSym = /* @__PURE__ */ Symbol.for("effect/FiberRefs");

class FiberRefsImpl {
  locals;
  [FiberRefsSym] = FiberRefsSym;
  constructor(locals) {
    this.locals = locals;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var findAncestor = (_ref, _parentStack, _childStack, _childModified = false) => {
  const ref = _ref;
  let parentStack = _parentStack;
  let childStack = _childStack;
  let childModified = _childModified;
  let ret = undefined;
  while (ret === undefined) {
    if (isNonEmptyReadonlyArray(parentStack) && isNonEmptyReadonlyArray(childStack)) {
      const parentFiberId = headNonEmpty(parentStack)[0];
      const parentAncestors = tailNonEmpty(parentStack);
      const childFiberId = headNonEmpty(childStack)[0];
      const childRefValue = headNonEmpty(childStack)[1];
      const childAncestors = tailNonEmpty(childStack);
      if (parentFiberId.startTimeMillis < childFiberId.startTimeMillis) {
        childStack = childAncestors;
        childModified = true;
      } else if (parentFiberId.startTimeMillis > childFiberId.startTimeMillis) {
        parentStack = parentAncestors;
      } else {
        if (parentFiberId.id < childFiberId.id) {
          childStack = childAncestors;
          childModified = true;
        } else if (parentFiberId.id > childFiberId.id) {
          parentStack = parentAncestors;
        } else {
          ret = [childRefValue, childModified];
        }
      }
    } else {
      ret = [ref.initial, true];
    }
  }
  return ret;
};
var joinAs = /* @__PURE__ */ dual(3, (self, fiberId2, that) => {
  const parentFiberRefs = new Map(self.locals);
  that.locals.forEach((childStack, fiberRef) => {
    const childValue = childStack[0][1];
    if (!childStack[0][0][symbol2](fiberId2)) {
      if (!parentFiberRefs.has(fiberRef)) {
        if (equals(childValue, fiberRef.initial)) {
          return;
        }
        parentFiberRefs.set(fiberRef, [[fiberId2, fiberRef.join(fiberRef.initial, childValue)]]);
        return;
      }
      const parentStack = parentFiberRefs.get(fiberRef);
      const [ancestor, wasModified] = findAncestor(fiberRef, parentStack, childStack);
      if (wasModified) {
        const patch9 = fiberRef.diff(ancestor, childValue);
        const oldValue = parentStack[0][1];
        const newValue = fiberRef.join(oldValue, fiberRef.patch(patch9)(oldValue));
        if (!equals(oldValue, newValue)) {
          let newStack;
          const parentFiberId = parentStack[0][0];
          if (parentFiberId[symbol2](fiberId2)) {
            newStack = [[parentFiberId, newValue], ...parentStack.slice(1)];
          } else {
            newStack = [[fiberId2, newValue], ...parentStack];
          }
          parentFiberRefs.set(fiberRef, newStack);
        }
      }
    }
  });
  return new FiberRefsImpl(parentFiberRefs);
});
var forkAs = /* @__PURE__ */ dual(2, (self, childId) => {
  const map10 = new Map;
  unsafeForkAs(self, map10, childId);
  return new FiberRefsImpl(map10);
});
var unsafeForkAs = (self, map10, fiberId2) => {
  self.locals.forEach((stack, fiberRef) => {
    const oldValue = stack[0][1];
    const newValue = fiberRef.patch(fiberRef.fork)(oldValue);
    if (equals(oldValue, newValue)) {
      map10.set(fiberRef, stack);
    } else {
      map10.set(fiberRef, [[fiberId2, newValue], ...stack]);
    }
  });
};
var delete_ = /* @__PURE__ */ dual(2, (self, fiberRef) => {
  const locals = new Map(self.locals);
  locals.delete(fiberRef);
  return new FiberRefsImpl(locals);
});
var get8 = /* @__PURE__ */ dual(2, (self, fiberRef) => {
  if (!self.locals.has(fiberRef)) {
    return none2();
  }
  return some2(headNonEmpty(self.locals.get(fiberRef))[1]);
});
var getOrDefault = /* @__PURE__ */ dual(2, (self, fiberRef) => pipe(get8(self, fiberRef), getOrElse(() => fiberRef.initial)));
var updateAs = /* @__PURE__ */ dual(2, (self, {
  fiberId: fiberId2,
  fiberRef,
  value
}) => {
  if (self.locals.size === 0) {
    return new FiberRefsImpl(new Map([[fiberRef, [[fiberId2, value]]]]));
  }
  const locals = new Map(self.locals);
  unsafeUpdateAs(locals, fiberId2, fiberRef, value);
  return new FiberRefsImpl(locals);
});
var unsafeUpdateAs = (locals, fiberId2, fiberRef, value) => {
  const oldStack = locals.get(fiberRef) ?? [];
  let newStack;
  if (isNonEmptyReadonlyArray(oldStack)) {
    const [currentId, currentValue] = headNonEmpty(oldStack);
    if (currentId[symbol2](fiberId2)) {
      if (equals(currentValue, value)) {
        return;
      } else {
        newStack = [[fiberId2, value], ...oldStack.slice(1)];
      }
    } else {
      newStack = [[fiberId2, value], ...oldStack];
    }
  } else {
    newStack = [[fiberId2, value]];
  }
  locals.set(fiberRef, newStack);
};
var updateManyAs = /* @__PURE__ */ dual(2, (self, {
  entries: entries2,
  forkAs: forkAs2
}) => {
  if (self.locals.size === 0) {
    return new FiberRefsImpl(new Map(entries2));
  }
  const locals = new Map(self.locals);
  if (forkAs2 !== undefined) {
    unsafeForkAs(self, locals, forkAs2);
  }
  entries2.forEach(([fiberRef, values3]) => {
    if (values3.length === 1) {
      unsafeUpdateAs(locals, values3[0][0], fiberRef, values3[0][1]);
    } else {
      values3.forEach(([fiberId2, value]) => {
        unsafeUpdateAs(locals, fiberId2, fiberRef, value);
      });
    }
  });
  return new FiberRefsImpl(locals);
});

// node_modules/effect/dist/esm/FiberRefs.js
var getOrDefault2 = getOrDefault;
var updateManyAs2 = updateManyAs;
var empty21 = empty20;

// node_modules/effect/dist/esm/internal/fiberRefs/patch.js
var OP_EMPTY2 = "Empty";
var OP_ADD = "Add";
var OP_REMOVE = "Remove";
var OP_UPDATE = "Update";
var OP_AND_THEN = "AndThen";
var empty22 = {
  _tag: OP_EMPTY2
};
var diff8 = (oldValue, newValue) => {
  const missingLocals = new Map(oldValue.locals);
  let patch9 = empty22;
  for (const [fiberRef, pairs] of newValue.locals.entries()) {
    const newValue2 = headNonEmpty(pairs)[1];
    const old = missingLocals.get(fiberRef);
    if (old !== undefined) {
      const oldValue2 = headNonEmpty(old)[1];
      if (!equals(oldValue2, newValue2)) {
        patch9 = combine10({
          _tag: OP_UPDATE,
          fiberRef,
          patch: fiberRef.diff(oldValue2, newValue2)
        })(patch9);
      }
    } else {
      patch9 = combine10({
        _tag: OP_ADD,
        fiberRef,
        value: newValue2
      })(patch9);
    }
    missingLocals.delete(fiberRef);
  }
  for (const [fiberRef] of missingLocals.entries()) {
    patch9 = combine10({
      _tag: OP_REMOVE,
      fiberRef
    })(patch9);
  }
  return patch9;
};
var combine10 = /* @__PURE__ */ dual(2, (self, that) => ({
  _tag: OP_AND_THEN,
  first: self,
  second: that
}));
var patch9 = /* @__PURE__ */ dual(3, (self, fiberId2, oldValue) => {
  let fiberRefs2 = oldValue;
  let patches = of(self);
  while (isNonEmptyReadonlyArray(patches)) {
    const head3 = headNonEmpty(patches);
    const tail = tailNonEmpty(patches);
    switch (head3._tag) {
      case OP_EMPTY2: {
        patches = tail;
        break;
      }
      case OP_ADD: {
        fiberRefs2 = updateAs(fiberRefs2, {
          fiberId: fiberId2,
          fiberRef: head3.fiberRef,
          value: head3.value
        });
        patches = tail;
        break;
      }
      case OP_REMOVE: {
        fiberRefs2 = delete_(fiberRefs2, head3.fiberRef);
        patches = tail;
        break;
      }
      case OP_UPDATE: {
        const value = getOrDefault(fiberRefs2, head3.fiberRef);
        fiberRefs2 = updateAs(fiberRefs2, {
          fiberId: fiberId2,
          fiberRef: head3.fiberRef,
          value: head3.fiberRef.patch(head3.patch)(value)
        });
        patches = tail;
        break;
      }
      case OP_AND_THEN: {
        patches = prepend(head3.first)(prepend(head3.second)(tail));
        break;
      }
    }
  }
  return fiberRefs2;
});

// node_modules/effect/dist/esm/FiberRefsPatch.js
var diff9 = diff8;
var patch10 = patch9;

// node_modules/effect/dist/esm/internal/fiberStatus.js
var FiberStatusSymbolKey = "effect/FiberStatus";
var FiberStatusTypeId = /* @__PURE__ */ Symbol.for(FiberStatusSymbolKey);
var OP_DONE = "Done";
var OP_RUNNING = "Running";
var OP_SUSPENDED = "Suspended";
var DoneHash = /* @__PURE__ */ string(`${FiberStatusSymbolKey}-${OP_DONE}`);

class Done {
  [FiberStatusTypeId] = FiberStatusTypeId;
  _tag = OP_DONE;
  [symbol]() {
    return DoneHash;
  }
  [symbol2](that) {
    return isFiberStatus(that) && that._tag === OP_DONE;
  }
}

class Running {
  runtimeFlags;
  [FiberStatusTypeId] = FiberStatusTypeId;
  _tag = OP_RUNNING;
  constructor(runtimeFlags) {
    this.runtimeFlags = runtimeFlags;
  }
  [symbol]() {
    return pipe(hash(FiberStatusSymbolKey), combine(hash(this._tag)), combine(hash(this.runtimeFlags)), cached(this));
  }
  [symbol2](that) {
    return isFiberStatus(that) && that._tag === OP_RUNNING && this.runtimeFlags === that.runtimeFlags;
  }
}

class Suspended {
  runtimeFlags;
  blockingOn;
  [FiberStatusTypeId] = FiberStatusTypeId;
  _tag = OP_SUSPENDED;
  constructor(runtimeFlags, blockingOn) {
    this.runtimeFlags = runtimeFlags;
    this.blockingOn = blockingOn;
  }
  [symbol]() {
    return pipe(hash(FiberStatusSymbolKey), combine(hash(this._tag)), combine(hash(this.runtimeFlags)), combine(hash(this.blockingOn)), cached(this));
  }
  [symbol2](that) {
    return isFiberStatus(that) && that._tag === OP_SUSPENDED && this.runtimeFlags === that.runtimeFlags && equals(this.blockingOn, that.blockingOn);
  }
}
var done2 = /* @__PURE__ */ new Done;
var running = (runtimeFlags) => new Running(runtimeFlags);
var suspended = (runtimeFlags, blockingOn) => new Suspended(runtimeFlags, blockingOn);
var isFiberStatus = (u) => hasProperty(u, FiberStatusTypeId);
var isDone2 = (self) => self._tag === OP_DONE;

// node_modules/effect/dist/esm/FiberStatus.js
var done3 = done2;
var running2 = running;
var suspended2 = suspended;
var isDone3 = isDone2;

// node_modules/effect/dist/esm/LogLevel.js
var All = logLevelAll;
var Fatal = logLevelFatal;
var Error2 = logLevelError;
var Warning = logLevelWarning;
var Info = logLevelInfo;
var Debug = logLevelDebug;
var Trace = logLevelTrace;
var None3 = logLevelNone;
var Order2 = /* @__PURE__ */ pipe(Order, /* @__PURE__ */ mapInput2((level) => level.ordinal));
var greaterThan2 = /* @__PURE__ */ greaterThan(Order2);
var fromLiteral = (literal) => {
  switch (literal) {
    case "All":
      return All;
    case "Debug":
      return Debug;
    case "Error":
      return Error2;
    case "Fatal":
      return Fatal;
    case "Info":
      return Info;
    case "Trace":
      return Trace;
    case "None":
      return None3;
    case "Warning":
      return Warning;
  }
};

// node_modules/effect/dist/esm/Readable.js
var TypeId9 = /* @__PURE__ */ Symbol.for("effect/Readable");
var Proto = {
  [TypeId9]: TypeId9,
  pipe() {
    return pipeArguments(this, arguments);
  }
};

// node_modules/effect/dist/esm/internal/ref.js
var RefTypeId = /* @__PURE__ */ Symbol.for("effect/Ref");
var refVariance = {
  _A: (_) => _
};

class RefImpl {
  ref;
  [RefTypeId] = refVariance;
  [TypeId9];
  constructor(ref) {
    this.ref = ref;
    this[TypeId9] = TypeId9;
    this.get = sync(() => get6(this.ref));
  }
  get;
  modify(f) {
    return sync(() => {
      const current = get6(this.ref);
      const [b, a] = f(current);
      if (current !== a) {
        set2(a)(this.ref);
      }
      return b;
    });
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var unsafeMake4 = (value) => new RefImpl(make9(value));
var make24 = (value) => sync(() => unsafeMake4(value));
var get9 = (self) => self.get;
var set4 = /* @__PURE__ */ dual(2, (self, value) => self.modify(() => [undefined, value]));
var modify2 = /* @__PURE__ */ dual(2, (self, f) => self.modify(f));
var update2 = /* @__PURE__ */ dual(2, (self, f) => self.modify((a) => [undefined, f(a)]));

// node_modules/effect/dist/esm/Ref.js
var make25 = make24;
var get10 = get9;
var modify3 = modify2;
var update3 = update2;

// node_modules/effect/dist/esm/Scheduler.js
class PriorityBuckets {
  buckets = [];
  scheduleTask(task, priority) {
    let bucket = undefined;
    let index;
    for (index = 0;index < this.buckets.length; index++) {
      if (this.buckets[index][0] <= priority) {
        bucket = this.buckets[index];
      } else {
        break;
      }
    }
    if (bucket) {
      bucket[1].push(task);
    } else {
      const newBuckets = [];
      for (let i = 0;i < index; i++) {
        newBuckets.push(this.buckets[i]);
      }
      newBuckets.push([priority, [task]]);
      for (let i = index;i < this.buckets.length; i++) {
        newBuckets.push(this.buckets[i]);
      }
      this.buckets = newBuckets;
    }
  }
}

class MixedScheduler {
  maxNextTickBeforeTimer;
  running = false;
  tasks = new PriorityBuckets;
  constructor(maxNextTickBeforeTimer) {
    this.maxNextTickBeforeTimer = maxNextTickBeforeTimer;
  }
  starveInternal(depth) {
    const tasks = this.tasks.buckets;
    this.tasks.buckets = [];
    for (const [_, toRun] of tasks) {
      for (let i = 0;i < toRun.length; i++) {
        toRun[i]();
      }
    }
    if (this.tasks.buckets.length === 0) {
      this.running = false;
    } else {
      this.starve(depth);
    }
  }
  starve(depth = 0) {
    if (depth >= this.maxNextTickBeforeTimer) {
      setTimeout(() => this.starveInternal(0), 0);
    } else {
      Promise.resolve(undefined).then(() => this.starveInternal(depth + 1));
    }
  }
  shouldYield(fiber) {
    return fiber.currentOpCount > fiber.getFiberRef(currentMaxOpsBeforeYield) ? fiber.getFiberRef(currentSchedulingPriority) : false;
  }
  scheduleTask(task, priority) {
    this.tasks.scheduleTask(task, priority);
    if (!this.running) {
      this.running = true;
      this.starve();
    }
  }
}
var defaultScheduler = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/Scheduler/defaultScheduler"), () => new MixedScheduler(2048));

class SyncScheduler {
  tasks = new PriorityBuckets;
  deferred = false;
  scheduleTask(task, priority) {
    if (this.deferred) {
      defaultScheduler.scheduleTask(task, priority);
    } else {
      this.tasks.scheduleTask(task, priority);
    }
  }
  shouldYield(fiber) {
    return fiber.currentOpCount > fiber.getFiberRef(currentMaxOpsBeforeYield) ? fiber.getFiberRef(currentSchedulingPriority) : false;
  }
  flush() {
    while (this.tasks.buckets.length > 0) {
      const tasks = this.tasks.buckets;
      this.tasks.buckets = [];
      for (const [_, toRun] of tasks) {
        for (let i = 0;i < toRun.length; i++) {
          toRun[i]();
        }
      }
    }
    this.deferred = true;
  }
}

class ControlledScheduler {
  tasks = new PriorityBuckets;
  deferred = false;
  scheduleTask(task, priority) {
    if (this.deferred) {
      defaultScheduler.scheduleTask(task, priority);
    } else {
      this.tasks.scheduleTask(task, priority);
    }
  }
  shouldYield(fiber) {
    return fiber.currentOpCount > fiber.getFiberRef(currentMaxOpsBeforeYield) ? fiber.getFiberRef(currentSchedulingPriority) : false;
  }
  step() {
    const tasks = this.tasks.buckets;
    this.tasks.buckets = [];
    for (const [_, toRun] of tasks) {
      for (let i = 0;i < toRun.length; i++) {
        toRun[i]();
      }
    }
  }
}
var currentScheduler = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentScheduler"), () => fiberRefUnsafeMake(defaultScheduler));

// node_modules/effect/dist/esm/internal/completedRequestMap.js
var currentRequestMap = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentRequestMap"), () => fiberRefUnsafeMake(new Map));

// node_modules/effect/dist/esm/internal/concurrency.js
var match7 = (concurrency, sequential4, unbounded, bounded) => {
  switch (concurrency) {
    case undefined:
      return sequential4();
    case "unbounded":
      return unbounded();
    case "inherit":
      return fiberRefGetWith(currentConcurrency, (concurrency2) => concurrency2 === "unbounded" ? unbounded() : concurrency2 > 1 ? bounded(concurrency2) : sequential4());
    default:
      return concurrency > 1 ? bounded(concurrency) : sequential4();
  }
};

// node_modules/effect/dist/esm/Clock.js
var sleep2 = sleep;
var currentTimeMillis2 = currentTimeMillis;

// node_modules/effect/dist/esm/internal/logSpan.js
var render = (now) => (self) => {
  const label = self.label.replace(/[\s="]/g, "_");
  return `${label}=${now - self.startTime}ms`;
};

// node_modules/effect/dist/esm/LogSpan.js
var render2 = render;

// node_modules/effect/dist/esm/internal/metric/label.js
var MetricLabelSymbolKey = "effect/MetricLabel";
var MetricLabelTypeId = /* @__PURE__ */ Symbol.for(MetricLabelSymbolKey);

class MetricLabelImpl {
  key;
  value;
  [MetricLabelTypeId] = MetricLabelTypeId;
  _hash;
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this._hash = string(MetricLabelSymbolKey + this.key + this.value);
  }
  [symbol]() {
    return this._hash;
  }
  [symbol2](that) {
    return isMetricLabel(that) && this.key === that.key && this.value === that.value;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var make27 = (key, value) => {
  return new MetricLabelImpl(key, value);
};
var isMetricLabel = (u) => hasProperty(u, MetricLabelTypeId);

// node_modules/effect/dist/esm/internal/singleShotGen.js
class SingleShotGen {
  self;
  called = false;
  constructor(self) {
    this.self = self;
  }
  next(a) {
    return this.called ? {
      value: a,
      done: true
    } : (this.called = true, {
      value: this.self,
      done: false
    });
  }
  return(a) {
    return {
      value: a,
      done: true
    };
  }
  throw(e) {
    throw e;
  }
  [Symbol.iterator]() {
    return new SingleShotGen(this.self);
  }
}

// node_modules/effect/dist/esm/internal/core-effect.js
var catchSomeCause = /* @__PURE__ */ dual(2, (self, f) => matchCauseEffect(self, {
  onFailure: (cause) => {
    const option = f(cause);
    switch (option._tag) {
      case "None": {
        return failCause(cause);
      }
      case "Some": {
        return option.value;
      }
    }
  },
  onSuccess: succeed
}));
var diffFiberRefs = (self) => summarized(self, fiberRefs2, diff8);
var match8 = /* @__PURE__ */ dual(2, (self, options) => matchEffect(self, {
  onFailure: (e) => succeed(options.onFailure(e)),
  onSuccess: (a) => succeed(options.onSuccess(a))
}));
var forever = (self) => {
  const loop = flatMap7(flatMap7(self, () => yieldNow()), () => loop);
  return loop;
};

class EffectGen {
  value;
  constructor(value) {
    this.value = value;
  }
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
}
var adapter2 = function() {
  let x = arguments[0];
  for (let i = 1;i < arguments.length; i++) {
    x = arguments[i](x);
  }
  return new EffectGen(x);
};
var gen = function() {
  let f;
  if (arguments.length === 1) {
    f = arguments[0];
  } else {
    f = arguments[1].bind(arguments[0]);
  }
  return suspend(() => {
    const iterator = f(adapter2);
    const state = iterator.next();
    const run = (state2) => state2.done ? succeed(state2.value) : pipe(state2.value.value, flatMap7((val) => run(iterator.next(val))));
    return run(state);
  });
};
var fiberRefs2 = /* @__PURE__ */ withFiberRuntime((state) => succeed(state.getFiberRefs()));
var ignore = (self) => match8(self, {
  onFailure: constVoid,
  onSuccess: constVoid
});
var logWithLevel = (level) => (messageOrCause, supplementary) => {
  const levelOption = fromNullable(level);
  let message;
  let cause;
  if (isCause(messageOrCause)) {
    cause = messageOrCause;
    message = supplementary ?? "";
  } else {
    message = messageOrCause;
    cause = supplementary ?? empty17;
  }
  return withFiberRuntime((fiberState) => {
    fiberState.log(message, cause, levelOption);
    return unit;
  });
};
var logWarning = /* @__PURE__ */ logWithLevel(Warning);
var mapErrorCause = /* @__PURE__ */ dual(2, (self, f) => matchCauseEffect(self, {
  onFailure: (c) => failCauseSync(() => f(c)),
  onSuccess: succeed
}));
var negate = (self) => map9(self, (b) => !b);
var patchFiberRefs = (patch11) => updateFiberRefs((fiberId2, fiberRefs3) => pipe(patch11, patch9(fiberId2, fiberRefs3)));
var sleep3 = sleep2;
var summarized = /* @__PURE__ */ dual(3, (self, summary, f) => flatMap7(summary, (start) => flatMap7(self, (value) => map9(summary, (end) => [f(start, end), value]))));
var tapError = /* @__PURE__ */ dual(2, (self, f) => matchCauseEffect(self, {
  onFailure: (cause) => {
    const either3 = failureOrCause(cause);
    switch (either3._tag) {
      case "Left":
        return zipRight(f(either3.left), failCause(cause));
      case "Right":
        return failCause(cause);
    }
  },
  onSuccess: succeed
}));
var tapErrorCause = /* @__PURE__ */ dual(2, (self, f) => matchCauseEffect(self, {
  onFailure: (cause) => zipRight(f(cause), failCause(cause)),
  onSuccess: succeed
}));
var tryPromise = (arg) => {
  let evaluate;
  let catcher = undefined;
  if (typeof arg === "function") {
    evaluate = arg;
  } else {
    evaluate = arg.try;
    catcher = arg.catch;
  }
  if (evaluate.length >= 1) {
    return async((resolve, signal) => {
      try {
        evaluate(signal).then((a) => resolve(exitSucceed(a)), (e) => resolve(fail2(catcher ? catcher(e) : new UnknownException(e))));
      } catch (e) {
        resolve(fail2(catcher ? catcher(e) : new UnknownException(e)));
      }
    });
  }
  return async((resolve) => {
    try {
      evaluate().then((a) => resolve(exitSucceed(a)), (e) => resolve(fail2(catcher ? catcher(e) : new UnknownException(e))));
    } catch (e) {
      resolve(fail2(catcher ? catcher(e) : new UnknownException(e)));
    }
  });
};
var updateFiberRefs = (f) => withFiberRuntime((state) => {
  state.setFiberRefs(f(state.id(), state.getFiberRefs()));
  return unit;
});
var when = /* @__PURE__ */ dual(2, (self, condition) => suspend(() => condition() ? map9(self, some2) : succeed(none2())));

// node_modules/effect/dist/esm/Exit.js
var isFailure = exitIsFailure;
var isSuccess = exitIsSuccess;
var all2 = exitCollectAll;
var die3 = exitDie;
var fail3 = exitFail;
var failCause3 = exitFailCause;
var map10 = exitMap;
var match9 = exitMatch;
var succeed3 = exitSucceed;
var unit2 = exitUnit;
var zip3 = exitZip;
var zipRight2 = exitZipRight;

// node_modules/effect/dist/esm/internal/fiberMessage.js
var OP_INTERRUPT_SIGNAL = "InterruptSignal";
var OP_STATEFUL = "Stateful";
var OP_RESUME = "Resume";
var OP_YIELD_NOW = "YieldNow";
var interruptSignal = (cause) => ({
  _tag: OP_INTERRUPT_SIGNAL,
  cause
});
var stateful = (onFiber) => ({
  _tag: OP_STATEFUL,
  onFiber
});
var resume = (effect) => ({
  _tag: OP_RESUME,
  effect
});
var yieldNow2 = () => ({
  _tag: OP_YIELD_NOW
});

// node_modules/effect/dist/esm/internal/fiberScope.js
var FiberScopeSymbolKey = "effect/FiberScope";
var FiberScopeTypeId = /* @__PURE__ */ Symbol.for(FiberScopeSymbolKey);

class Global {
  [FiberScopeTypeId] = FiberScopeTypeId;
  fiberId = none4;
  roots = new Set;
  add(_runtimeFlags, child) {
    this.roots.add(child);
    child.addObserver(() => {
      this.roots.delete(child);
    });
  }
}

class Local {
  fiberId;
  parent;
  [FiberScopeTypeId] = FiberScopeTypeId;
  constructor(fiberId2, parent) {
    this.fiberId = fiberId2;
    this.parent = parent;
  }
  add(_runtimeFlags, child) {
    this.parent.tell(stateful((parentFiber) => {
      parentFiber.addChild(child);
      child.addObserver(() => {
        parentFiber.removeChild(child);
      });
    }));
  }
}
var unsafeMake5 = (fiber) => {
  return new Local(fiber.id(), fiber);
};
var globalScope = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberScope/Global"), () => new Global);

// node_modules/effect/dist/esm/internal/fiber.js
var FiberSymbolKey = "effect/Fiber";
var FiberTypeId = /* @__PURE__ */ Symbol.for(FiberSymbolKey);
var fiberVariance = {
  _E: (_) => _,
  _A: (_) => _
};
var fiberProto = {
  [FiberTypeId]: fiberVariance,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var RuntimeFiberSymbolKey = "effect/Fiber";
var RuntimeFiberTypeId = /* @__PURE__ */ Symbol.for(RuntimeFiberSymbolKey);
var _await2 = (self) => self.await;
var inheritAll = (self) => self.inheritAll;
var join2 = (self) => zipLeft(flatten3(self.await), self.inheritAll);
var never2 = {
  ...fiberProto,
  id: () => none4,
  await: never,
  children: /* @__PURE__ */ succeed([]),
  inheritAll: never,
  poll: /* @__PURE__ */ succeed(/* @__PURE__ */ none2()),
  interruptAsFork: () => never
};
var currentFiberURI = "effect/FiberCurrent";

// node_modules/effect/dist/esm/internal/logger.js
var LoggerSymbolKey = "effect/Logger";
var LoggerTypeId = /* @__PURE__ */ Symbol.for(LoggerSymbolKey);
var loggerVariance = {
  _Message: (_) => _,
  _Output: (_) => _
};
var makeLogger = (log) => ({
  [LoggerTypeId]: loggerVariance,
  log,
  pipe() {
    return pipeArguments(this, arguments);
  }
});
var none6 = {
  [LoggerTypeId]: loggerVariance,
  log: constVoid,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var stringLogger = /* @__PURE__ */ makeLogger(({
  annotations,
  cause,
  date,
  fiberId: fiberId2,
  logLevel,
  message,
  spans
}) => {
  const nowMillis = date.getTime();
  const outputArray = [`timestamp=${date.toISOString()}`, `level=${logLevel.label}`, `fiber=${threadName(fiberId2)}`];
  let output = outputArray.join(" ");
  const stringMessage = toStringUnknown(message);
  if (stringMessage.length > 0) {
    output = output + " message=";
    output = appendQuoted(stringMessage, output);
  }
  if (cause != null && cause._tag !== "Empty") {
    output = output + " cause=";
    output = appendQuoted(pretty(cause), output);
  }
  if (isCons(spans)) {
    output = output + " ";
    let first = true;
    for (const span2 of spans) {
      if (first) {
        first = false;
      } else {
        output = output + " ";
      }
      output = output + pipe(span2, render2(nowMillis));
    }
  }
  if (pipe(annotations, size4) > 0) {
    output = output + " ";
    let first = true;
    for (const [key, value] of annotations) {
      if (first) {
        first = false;
      } else {
        output = output + " ";
      }
      output = output + filterKeyName(key);
      output = output + "=";
      output = appendQuoted(toStringUnknown(value), output);
    }
  }
  return output;
});
var escapeDoubleQuotes = (str) => `"${str.replace(/\\([\s\S])|(")/g, "\\$1$2")}"`;
var textOnly = /^[^\s"=]+$/;
var appendQuoted = (label, output) => output + (label.match(textOnly) ? label : escapeDoubleQuotes(label));
var filterKeyName = (key) => key.replace(/[\s="]/g, "_");

// node_modules/effect/dist/esm/internal/metric/boundaries.js
var MetricBoundariesSymbolKey = "effect/MetricBoundaries";
var MetricBoundariesTypeId = /* @__PURE__ */ Symbol.for(MetricBoundariesSymbolKey);

class MetricBoundariesImpl {
  values;
  [MetricBoundariesTypeId] = MetricBoundariesTypeId;
  constructor(values3) {
    this.values = values3;
    this._hash = pipe(string(MetricBoundariesSymbolKey), combine(array(this.values)));
  }
  _hash;
  [symbol]() {
    return this._hash;
  }
  [symbol2](u) {
    return isMetricBoundaries(u) && equals(this.values, u.values);
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var isMetricBoundaries = (u) => hasProperty(u, MetricBoundariesTypeId);
var fromIterable7 = (iterable) => {
  const values3 = pipe(iterable, appendAll(of2(Number.POSITIVE_INFINITY)), dedupe);
  return new MetricBoundariesImpl(values3);
};
var exponential = (options) => pipe(makeBy(options.count - 1, (i) => options.start * Math.pow(options.factor, i)), unsafeFromArray, fromIterable7);

// node_modules/effect/dist/esm/internal/metric/keyType.js
var MetricKeyTypeSymbolKey = "effect/MetricKeyType";
var MetricKeyTypeTypeId = /* @__PURE__ */ Symbol.for(MetricKeyTypeSymbolKey);
var CounterKeyTypeSymbolKey = "effect/MetricKeyType/Counter";
var CounterKeyTypeTypeId = /* @__PURE__ */ Symbol.for(CounterKeyTypeSymbolKey);
var FrequencyKeyTypeSymbolKey = "effect/MetricKeyType/Frequency";
var FrequencyKeyTypeTypeId = /* @__PURE__ */ Symbol.for(FrequencyKeyTypeSymbolKey);
var GaugeKeyTypeSymbolKey = "effect/MetricKeyType/Gauge";
var GaugeKeyTypeTypeId = /* @__PURE__ */ Symbol.for(GaugeKeyTypeSymbolKey);
var HistogramKeyTypeSymbolKey = "effect/MetricKeyType/Histogram";
var HistogramKeyTypeTypeId = /* @__PURE__ */ Symbol.for(HistogramKeyTypeSymbolKey);
var SummaryKeyTypeSymbolKey = "effect/MetricKeyType/Summary";
var SummaryKeyTypeTypeId = /* @__PURE__ */ Symbol.for(SummaryKeyTypeSymbolKey);
var metricKeyTypeVariance = {
  _In: (_) => _,
  _Out: (_) => _
};

class CounterKeyType {
  incremental;
  bigint;
  [MetricKeyTypeTypeId] = metricKeyTypeVariance;
  [CounterKeyTypeTypeId] = CounterKeyTypeTypeId;
  constructor(incremental, bigint) {
    this.incremental = incremental;
    this.bigint = bigint;
    this._hash = string(CounterKeyTypeSymbolKey);
  }
  _hash;
  [symbol]() {
    return this._hash;
  }
  [symbol2](that) {
    return isCounterKey(that);
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
class HistogramKeyType {
  boundaries;
  [MetricKeyTypeTypeId] = metricKeyTypeVariance;
  [HistogramKeyTypeTypeId] = HistogramKeyTypeTypeId;
  constructor(boundaries) {
    this.boundaries = boundaries;
    this._hash = pipe(string(HistogramKeyTypeSymbolKey), combine(hash(this.boundaries)));
  }
  _hash;
  [symbol]() {
    return this._hash;
  }
  [symbol2](that) {
    return isHistogramKey(that) && equals(this.boundaries, that.boundaries);
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var counter = (options) => new CounterKeyType(options?.incremental ?? false, options?.bigint ?? false);
var histogram = (boundaries) => {
  return new HistogramKeyType(boundaries);
};
var isCounterKey = (u) => hasProperty(u, CounterKeyTypeTypeId);
var isFrequencyKey = (u) => hasProperty(u, FrequencyKeyTypeTypeId);
var isGaugeKey = (u) => hasProperty(u, GaugeKeyTypeTypeId);
var isHistogramKey = (u) => hasProperty(u, HistogramKeyTypeTypeId);
var isSummaryKey = (u) => hasProperty(u, SummaryKeyTypeTypeId);

// node_modules/effect/dist/esm/internal/metric/key.js
var MetricKeySymbolKey = "effect/MetricKey";
var MetricKeyTypeId = /* @__PURE__ */ Symbol.for(MetricKeySymbolKey);
var metricKeyVariance = {
  _Type: (_) => _
};
var arrayEquivilence = /* @__PURE__ */ getEquivalence(equals);

class MetricKeyImpl {
  name;
  keyType;
  description;
  tags;
  [MetricKeyTypeId] = metricKeyVariance;
  constructor(name, keyType, description, tags = []) {
    this.name = name;
    this.keyType = keyType;
    this.description = description;
    this.tags = tags;
    this._hash = pipe(string(this.name + this.description), combine(hash(this.keyType)), combine(array(this.tags)));
  }
  _hash;
  [symbol]() {
    return this._hash;
  }
  [symbol2](u) {
    return isMetricKey(u) && this.name === u.name && equals(this.keyType, u.keyType) && equals(this.description, u.description) && arrayEquivilence(this.tags, u.tags);
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var isMetricKey = (u) => hasProperty(u, MetricKeyTypeId);
var counter2 = (name, options) => new MetricKeyImpl(name, counter(options), fromNullable(options?.description));
var histogram2 = (name, boundaries, description) => new MetricKeyImpl(name, histogram(boundaries), fromNullable(description));
var taggedWithLabels = /* @__PURE__ */ dual(2, (self, extraTags) => extraTags.length === 0 ? self : new MetricKeyImpl(self.name, self.keyType, self.description, union(self.tags, extraTags)));

// node_modules/effect/dist/esm/MutableHashMap.js
var TypeId10 = /* @__PURE__ */ Symbol.for("effect/MutableHashMap");
var MutableHashMapProto = {
  [TypeId10]: TypeId10,
  [Symbol.iterator]() {
    return new MutableHashMapIterator(this);
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "MutableHashMap",
      values: Array.from(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};

class MutableHashMapIterator {
  self;
  referentialIterator;
  bucketIterator;
  constructor(self) {
    this.self = self;
    this.referentialIterator = self.referential[Symbol.iterator]();
  }
  next() {
    if (this.bucketIterator !== undefined) {
      return this.bucketIterator.next();
    }
    const result = this.referentialIterator.next();
    if (result.done) {
      this.bucketIterator = new BucketIterator(this.self.buckets.values());
      return this.next();
    }
    return result;
  }
  [Symbol.iterator]() {
    return new MutableHashMapIterator(this.self);
  }
}

class BucketIterator {
  backing;
  constructor(backing) {
    this.backing = backing;
  }
  currentBucket;
  next() {
    if (this.currentBucket === undefined) {
      const result2 = this.backing.next();
      if (result2.done) {
        return result2;
      }
      this.currentBucket = result2.value[Symbol.iterator]();
    }
    const result = this.currentBucket.next();
    if (result.done) {
      this.currentBucket = undefined;
      return this.next();
    }
    return result;
  }
}
var empty23 = () => {
  const self = Object.create(MutableHashMapProto);
  self.referential = new Map;
  self.buckets = new Map;
  self.bucketsSize = 0;
  return self;
};
var get12 = /* @__PURE__ */ dual(2, (self, key) => {
  if (isEqual(key) === false) {
    return self.referential.has(key) ? some2(self.referential.get(key)) : none2();
  }
  const hash2 = key[symbol]();
  const bucket = self.buckets.get(hash2);
  if (bucket === undefined) {
    return none2();
  }
  return getFromBucket(self, bucket, key);
});
var getFromBucket = (self, bucket, key, remove6 = false) => {
  for (let i = 0, len = bucket.length;i < len; i++) {
    if (key[symbol2](bucket[i][0])) {
      const value = bucket[i][1];
      if (remove6) {
        bucket.splice(i, 1);
        self.bucketsSize--;
      }
      return some2(value);
    }
  }
  return none2();
};
var has4 = /* @__PURE__ */ dual(2, (self, key) => isSome2(get12(self, key)));
var set5 = /* @__PURE__ */ dual(3, (self, key, value) => {
  if (isEqual(key) === false) {
    self.referential.set(key, value);
    return self;
  }
  const hash2 = key[symbol]();
  const bucket = self.buckets.get(hash2);
  if (bucket === undefined) {
    self.buckets.set(hash2, [[key, value]]);
    self.bucketsSize++;
    return self;
  }
  removeFromBucket(self, bucket, key);
  bucket.push([key, value]);
  self.bucketsSize++;
  return self;
});
var removeFromBucket = (self, bucket, key) => {
  for (let i = 0, len = bucket.length;i < len; i++) {
    if (key[symbol2](bucket[i][0])) {
      bucket.splice(i, 1);
      self.bucketsSize--;
      return;
    }
  }
};

// node_modules/effect/dist/esm/internal/metric/state.js
var MetricStateSymbolKey = "effect/MetricState";
var MetricStateTypeId = /* @__PURE__ */ Symbol.for(MetricStateSymbolKey);
var CounterStateSymbolKey = "effect/MetricState/Counter";
var CounterStateTypeId = /* @__PURE__ */ Symbol.for(CounterStateSymbolKey);
var FrequencyStateSymbolKey = "effect/MetricState/Frequency";
var FrequencyStateTypeId = /* @__PURE__ */ Symbol.for(FrequencyStateSymbolKey);
var GaugeStateSymbolKey = "effect/MetricState/Gauge";
var GaugeStateTypeId = /* @__PURE__ */ Symbol.for(GaugeStateSymbolKey);
var HistogramStateSymbolKey = "effect/MetricState/Histogram";
var HistogramStateTypeId = /* @__PURE__ */ Symbol.for(HistogramStateSymbolKey);
var SummaryStateSymbolKey = "effect/MetricState/Summary";
var SummaryStateTypeId = /* @__PURE__ */ Symbol.for(SummaryStateSymbolKey);
var metricStateVariance = {
  _A: (_) => _
};

class CounterState {
  count;
  [MetricStateTypeId] = metricStateVariance;
  [CounterStateTypeId] = CounterStateTypeId;
  constructor(count) {
    this.count = count;
  }
  [symbol]() {
    return pipe(hash(CounterStateSymbolKey), combine(hash(this.count)), cached(this));
  }
  [symbol2](that) {
    return isCounterState(that) && this.count === that.count;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var arrayEquals = /* @__PURE__ */ getEquivalence(equals);

class FrequencyState {
  occurrences;
  [MetricStateTypeId] = metricStateVariance;
  [FrequencyStateTypeId] = FrequencyStateTypeId;
  constructor(occurrences) {
    this.occurrences = occurrences;
  }
  _hash;
  [symbol]() {
    return pipe(string(FrequencyStateSymbolKey), combine(array(fromIterable(this.occurrences.entries()))), cached(this));
  }
  [symbol2](that) {
    return isFrequencyState(that) && arrayEquals(fromIterable(this.occurrences.entries()), fromIterable(that.occurrences.entries()));
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}

class GaugeState {
  value;
  [MetricStateTypeId] = metricStateVariance;
  [GaugeStateTypeId] = GaugeStateTypeId;
  constructor(value) {
    this.value = value;
  }
  [symbol]() {
    return pipe(hash(GaugeStateSymbolKey), combine(hash(this.value)), cached(this));
  }
  [symbol2](u) {
    return isGaugeState(u) && this.value === u.value;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}

class HistogramState {
  buckets;
  count;
  min;
  max;
  sum;
  [MetricStateTypeId] = metricStateVariance;
  [HistogramStateTypeId] = HistogramStateTypeId;
  constructor(buckets, count, min2, max2, sum2) {
    this.buckets = buckets;
    this.count = count;
    this.min = min2;
    this.max = max2;
    this.sum = sum2;
  }
  [symbol]() {
    return pipe(hash(HistogramStateSymbolKey), combine(hash(this.buckets)), combine(hash(this.count)), combine(hash(this.min)), combine(hash(this.max)), combine(hash(this.sum)), cached(this));
  }
  [symbol2](that) {
    return isHistogramState(that) && equals(this.buckets, that.buckets) && this.count === that.count && this.min === that.min && this.max === that.max && this.sum === that.sum;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}

class SummaryState {
  error;
  quantiles;
  count;
  min;
  max;
  sum;
  [MetricStateTypeId] = metricStateVariance;
  [SummaryStateTypeId] = SummaryStateTypeId;
  constructor(error, quantiles, count, min2, max2, sum2) {
    this.error = error;
    this.quantiles = quantiles;
    this.count = count;
    this.min = min2;
    this.max = max2;
    this.sum = sum2;
  }
  [symbol]() {
    return pipe(hash(SummaryStateSymbolKey), combine(hash(this.error)), combine(hash(this.quantiles)), combine(hash(this.count)), combine(hash(this.min)), combine(hash(this.max)), combine(hash(this.sum)), cached(this));
  }
  [symbol2](that) {
    return isSummaryState(that) && this.error === that.error && equals(this.quantiles, that.quantiles) && this.count === that.count && this.min === that.min && this.max === that.max && this.sum === that.sum;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var counter3 = (count) => new CounterState(count);
var frequency2 = (occurrences) => {
  return new FrequencyState(occurrences);
};
var gauge2 = (count) => new GaugeState(count);
var histogram3 = (options) => new HistogramState(options.buckets, options.count, options.min, options.max, options.sum);
var summary2 = (options) => new SummaryState(options.error, options.quantiles, options.count, options.min, options.max, options.sum);
var isCounterState = (u) => hasProperty(u, CounterStateTypeId);
var isFrequencyState = (u) => hasProperty(u, FrequencyStateTypeId);
var isGaugeState = (u) => hasProperty(u, GaugeStateTypeId);
var isHistogramState = (u) => hasProperty(u, HistogramStateTypeId);
var isSummaryState = (u) => hasProperty(u, SummaryStateTypeId);

// node_modules/effect/dist/esm/internal/metric/hook.js
var MetricHookSymbolKey = "effect/MetricHook";
var MetricHookTypeId = /* @__PURE__ */ Symbol.for(MetricHookSymbolKey);
var metricHookVariance = {
  _In: (_) => _,
  _Out: (_) => _
};
var make29 = (options) => ({
  [MetricHookTypeId]: metricHookVariance,
  pipe() {
    return pipeArguments(this, arguments);
  },
  ...options
});
var bigint02 = /* @__PURE__ */ BigInt(0);
var counter4 = (key) => {
  let sum2 = key.keyType.bigint ? bigint02 : 0;
  const canUpdate = key.keyType.incremental ? key.keyType.bigint ? (value) => value >= bigint02 : (value) => value >= 0 : (_value) => true;
  return make29({
    get: () => counter3(sum2),
    update: (value) => {
      if (canUpdate(value)) {
        sum2 = sum2 + value;
      }
    }
  });
};
var frequency3 = (_key) => {
  const values3 = new Map;
  const update4 = (word) => {
    const slotCount = values3.get(word) ?? 0;
    values3.set(word, slotCount + 1);
  };
  return make29({
    get: () => frequency2(values3),
    update: update4
  });
};
var gauge3 = (_key, startAt) => {
  let value = startAt;
  return make29({
    get: () => gauge2(value),
    update: (v) => {
      value = v;
    }
  });
};
var histogram4 = (key) => {
  const bounds = key.keyType.boundaries.values;
  const size5 = bounds.length;
  const values3 = new Uint32Array(size5 + 1);
  const boundaries = new Float32Array(size5);
  let count = 0;
  let sum2 = 0;
  let min2 = Number.MAX_VALUE;
  let max2 = Number.MIN_VALUE;
  pipe(bounds, sort(Order), map2((n, i) => {
    boundaries[i] = n;
  }));
  const update4 = (value) => {
    let from = 0;
    let to = size5;
    while (from !== to) {
      const mid = Math.floor(from + (to - from) / 2);
      const boundary = boundaries[mid];
      if (value <= boundary) {
        to = mid;
      } else {
        from = mid;
      }
      if (to === from + 1) {
        if (value <= boundaries[from]) {
          to = from;
        } else {
          from = to;
        }
      }
    }
    values3[from] = values3[from] + 1;
    count = count + 1;
    sum2 = sum2 + value;
    if (value < min2) {
      min2 = value;
    }
    if (value > max2) {
      max2 = value;
    }
  };
  const getBuckets = () => {
    const builder = Array(size5);
    let cumulated = 0;
    for (let i = 0;i < size5; i++) {
      const boundary = boundaries[i];
      const value = values3[i];
      cumulated = cumulated + value;
      builder[i] = [boundary, cumulated];
    }
    return builder;
  };
  return make29({
    get: () => histogram3({
      buckets: getBuckets(),
      count,
      min: min2,
      max: max2,
      sum: sum2
    }),
    update: update4
  });
};
var summary3 = (key) => {
  const {
    error,
    maxAge,
    maxSize,
    quantiles
  } = key.keyType;
  const sortedQuantiles = pipe(quantiles, sort(Order));
  const values3 = Array(maxSize);
  let head3 = 0;
  let count = 0;
  let sum2 = 0;
  let min2 = Number.MAX_VALUE;
  let max2 = Number.MIN_VALUE;
  const snapshot = (now) => {
    const builder = [];
    let i = 0;
    while (i !== maxSize - 1) {
      const item = values3[i];
      if (item != null) {
        const [t, v] = item;
        const age = millis(now - t);
        if (greaterThanOrEqualTo(age, zero) && age <= maxAge) {
          builder.push(v);
        }
      }
      i = i + 1;
    }
    return calculateQuantiles(error, sortedQuantiles, sort(builder, Order));
  };
  const observe = (value, timestamp) => {
    if (maxSize > 0) {
      head3 = head3 + 1;
      const target = head3 % maxSize;
      values3[target] = [timestamp, value];
    }
    count = count + 1;
    sum2 = sum2 + value;
    if (value < min2) {
      min2 = value;
    }
    if (value > max2) {
      max2 = value;
    }
  };
  return make29({
    get: () => summary2({
      error,
      quantiles: snapshot(Date.now()),
      count,
      min: min2,
      max: max2,
      sum: sum2
    }),
    update: ([value, timestamp]) => observe(value, timestamp)
  });
};
var calculateQuantiles = (error, sortedQuantiles, sortedSamples) => {
  const sampleCount = sortedSamples.length;
  if (!isNonEmptyReadonlyArray(sortedQuantiles)) {
    return empty3();
  }
  const head3 = sortedQuantiles[0];
  const tail = sortedQuantiles.slice(1);
  const resolvedHead = resolveQuantile(error, sampleCount, none2(), 0, head3, sortedSamples);
  const resolved = of(resolvedHead);
  tail.forEach((quantile) => {
    resolved.push(resolveQuantile(error, sampleCount, resolvedHead.value, resolvedHead.consumed, quantile, resolvedHead.rest));
  });
  return map2(resolved, (rq) => [rq.quantile, rq.value]);
};
var resolveQuantile = (error, sampleCount, current, consumed, quantile, rest) => {
  let error_1 = error;
  let sampleCount_1 = sampleCount;
  let current_1 = current;
  let consumed_1 = consumed;
  let quantile_1 = quantile;
  let rest_1 = rest;
  let error_2 = error;
  let sampleCount_2 = sampleCount;
  let current_2 = current;
  let consumed_2 = consumed;
  let quantile_2 = quantile;
  let rest_2 = rest;
  while (true) {
    if (!isNonEmptyReadonlyArray(rest_1)) {
      return {
        quantile: quantile_1,
        value: none2(),
        consumed: consumed_1,
        rest: []
      };
    }
    if (quantile_1 === 1) {
      return {
        quantile: quantile_1,
        value: some2(lastNonEmpty(rest_1)),
        consumed: consumed_1 + rest_1.length,
        rest: []
      };
    }
    const sameHead = span(rest_1, (n) => n <= rest_1[0]);
    const desired = quantile_1 * sampleCount_1;
    const allowedError = error_1 / 2 * desired;
    const candConsumed = consumed_1 + sameHead[0].length;
    const candError = Math.abs(candConsumed - desired);
    if (candConsumed < desired - allowedError) {
      error_2 = error_1;
      sampleCount_2 = sampleCount_1;
      current_2 = head(rest_1);
      consumed_2 = candConsumed;
      quantile_2 = quantile_1;
      rest_2 = sameHead[1];
      error_1 = error_2;
      sampleCount_1 = sampleCount_2;
      current_1 = current_2;
      consumed_1 = consumed_2;
      quantile_1 = quantile_2;
      rest_1 = rest_2;
      continue;
    }
    if (candConsumed > desired + allowedError) {
      return {
        quantile: quantile_1,
        value: current_1,
        consumed: consumed_1,
        rest: rest_1
      };
    }
    switch (current_1._tag) {
      case "None": {
        error_2 = error_1;
        sampleCount_2 = sampleCount_1;
        current_2 = head(rest_1);
        consumed_2 = candConsumed;
        quantile_2 = quantile_1;
        rest_2 = sameHead[1];
        error_1 = error_2;
        sampleCount_1 = sampleCount_2;
        current_1 = current_2;
        consumed_1 = consumed_2;
        quantile_1 = quantile_2;
        rest_1 = rest_2;
        continue;
      }
      case "Some": {
        const prevError = Math.abs(desired - current_1.value);
        if (candError < prevError) {
          error_2 = error_1;
          sampleCount_2 = sampleCount_1;
          current_2 = head(rest_1);
          consumed_2 = candConsumed;
          quantile_2 = quantile_1;
          rest_2 = sameHead[1];
          error_1 = error_2;
          sampleCount_1 = sampleCount_2;
          current_1 = current_2;
          consumed_1 = consumed_2;
          quantile_1 = quantile_2;
          rest_1 = rest_2;
          continue;
        }
        return {
          quantile: quantile_1,
          value: some2(current_1.value),
          consumed: consumed_1,
          rest: rest_1
        };
      }
    }
  }
  throw new Error("BUG: MetricHook.resolveQuantiles - please report an issue at https://github.com/Effect-TS/effect/issues");
};

// node_modules/effect/dist/esm/internal/metric/pair.js
var MetricPairSymbolKey = "effect/MetricPair";
var MetricPairTypeId = /* @__PURE__ */ Symbol.for(MetricPairSymbolKey);
var metricPairVariance = {
  _Type: (_) => _
};
var unsafeMake6 = (metricKey, metricState) => {
  return {
    [MetricPairTypeId]: metricPairVariance,
    metricKey,
    metricState,
    pipe() {
      return pipeArguments(this, arguments);
    }
  };
};

// node_modules/effect/dist/esm/internal/metric/registry.js
var MetricRegistrySymbolKey = "effect/MetricRegistry";
var MetricRegistryTypeId = /* @__PURE__ */ Symbol.for(MetricRegistrySymbolKey);

class MetricRegistryImpl {
  [MetricRegistryTypeId] = MetricRegistryTypeId;
  map = empty23();
  snapshot() {
    const result = [];
    for (const [key, hook] of this.map) {
      result.push(unsafeMake6(key, hook.get()));
    }
    return result;
  }
  get(key) {
    const hook = pipe(this.map, get12(key), getOrUndefined);
    if (hook == null) {
      if (isCounterKey(key.keyType)) {
        return this.getCounter(key);
      }
      if (isGaugeKey(key.keyType)) {
        return this.getGauge(key);
      }
      if (isFrequencyKey(key.keyType)) {
        return this.getFrequency(key);
      }
      if (isHistogramKey(key.keyType)) {
        return this.getHistogram(key);
      }
      if (isSummaryKey(key.keyType)) {
        return this.getSummary(key);
      }
      throw new Error("BUG: MetricRegistry.get - unknown MetricKeyType - please report an issue at https://github.com/Effect-TS/effect/issues");
    } else {
      return hook;
    }
  }
  getCounter(key) {
    let value = pipe(this.map, get12(key), getOrUndefined);
    if (value == null) {
      const counter5 = counter4(key);
      if (!pipe(this.map, has4(key))) {
        pipe(this.map, set5(key, counter5));
      }
      value = counter5;
    }
    return value;
  }
  getFrequency(key) {
    let value = pipe(this.map, get12(key), getOrUndefined);
    if (value == null) {
      const frequency4 = frequency3(key);
      if (!pipe(this.map, has4(key))) {
        pipe(this.map, set5(key, frequency4));
      }
      value = frequency4;
    }
    return value;
  }
  getGauge(key) {
    let value = pipe(this.map, get12(key), getOrUndefined);
    if (value == null) {
      const gauge4 = gauge3(key, key.keyType.bigint ? BigInt(0) : 0);
      if (!pipe(this.map, has4(key))) {
        pipe(this.map, set5(key, gauge4));
      }
      value = gauge4;
    }
    return value;
  }
  getHistogram(key) {
    let value = pipe(this.map, get12(key), getOrUndefined);
    if (value == null) {
      const histogram5 = histogram4(key);
      if (!pipe(this.map, has4(key))) {
        pipe(this.map, set5(key, histogram5));
      }
      value = histogram5;
    }
    return value;
  }
  getSummary(key) {
    let value = pipe(this.map, get12(key), getOrUndefined);
    if (value == null) {
      const summary4 = summary3(key);
      if (!pipe(this.map, has4(key))) {
        pipe(this.map, set5(key, summary4));
      }
      value = summary4;
    }
    return value;
  }
}
var make30 = () => {
  return new MetricRegistryImpl;
};

// node_modules/effect/dist/esm/internal/metric.js
var MetricSymbolKey = "effect/Metric";
var MetricTypeId = /* @__PURE__ */ Symbol.for(MetricSymbolKey);
var metricVariance = {
  _Type: (_) => _,
  _In: (_) => _,
  _Out: (_) => _
};
var globalMetricRegistry = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/Metric/globalMetricRegistry"), () => make30());
var make31 = function(keyType, unsafeUpdate, unsafeValue) {
  const metric = Object.assign((effect) => tap(effect, (a) => update4(metric, a)), {
    [MetricTypeId]: metricVariance,
    keyType,
    unsafeUpdate,
    unsafeValue,
    register() {
      this.unsafeValue([]);
      return this;
    },
    pipe() {
      return pipeArguments(this, arguments);
    }
  });
  return metric;
};
var counter5 = (name, options) => fromMetricKey(counter2(name, options));
var fromMetricKey = (key) => {
  let untaggedHook;
  const hookCache = new WeakMap;
  const hook = (extraTags) => {
    if (extraTags.length === 0) {
      if (untaggedHook !== undefined) {
        return untaggedHook;
      }
      untaggedHook = globalMetricRegistry.get(key);
      return untaggedHook;
    }
    let hook2 = hookCache.get(extraTags);
    if (hook2 !== undefined) {
      return hook2;
    }
    hook2 = globalMetricRegistry.get(taggedWithLabels(key, extraTags));
    hookCache.set(extraTags, hook2);
    return hook2;
  };
  return make31(key.keyType, (input, extraTags) => hook(extraTags).update(input), (extraTags) => hook(extraTags).get());
};
var histogram5 = (name, boundaries, description) => fromMetricKey(histogram2(name, boundaries, description));
var tagged = /* @__PURE__ */ dual(3, (self, key, value) => taggedWithLabels2(self, [make27(key, value)]));
var taggedWithLabels2 = /* @__PURE__ */ dual(2, (self, extraTags) => {
  return make31(self.keyType, (input, extraTags1) => self.unsafeUpdate(input, union(extraTags, extraTags1)), (extraTags1) => self.unsafeValue(union(extraTags, extraTags1)));
});
var update4 = /* @__PURE__ */ dual(2, (self, input) => fiberRefGetWith(currentMetricLabels, (tags) => sync(() => self.unsafeUpdate(input, tags))));

// node_modules/effect/dist/esm/internal/request.js
var RequestSymbolKey = "effect/Request";
var RequestTypeId = /* @__PURE__ */ Symbol.for(RequestSymbolKey);
var requestVariance = {
  _E: (_) => _,
  _A: (_) => _
};
var RequestPrototype = {
  ...StructuralPrototype,
  [RequestTypeId]: requestVariance
};
var complete = /* @__PURE__ */ dual(2, (self, result) => fiberRefGetWith(currentRequestMap, (map11) => sync(() => {
  if (map11.has(self)) {
    const entry = map11.get(self);
    if (!entry.state.completed) {
      entry.state.completed = true;
      deferredUnsafeDone(entry.result, result);
    }
  }
})));
class Listeners {
  count = 0;
  observers = new Set;
  interrupted = false;
  addObserver(f) {
    this.observers.add(f);
  }
  removeObserver(f) {
    this.observers.delete(f);
  }
  increment() {
    this.count++;
    this.observers.forEach((f) => f(this.count));
  }
  decrement() {
    this.count--;
    this.observers.forEach((f) => f(this.count));
  }
}

// node_modules/effect/dist/esm/internal/redBlackTree/iterator.js
var Direction = {
  Forward: 0,
  Backward: 1 << 0
};

class RedBlackTreeIterator {
  self;
  stack;
  direction;
  count = 0;
  constructor(self, stack, direction) {
    this.self = self;
    this.stack = stack;
    this.direction = direction;
  }
  clone() {
    return new RedBlackTreeIterator(this.self, this.stack.slice(), this.direction);
  }
  reversed() {
    return new RedBlackTreeIterator(this.self, this.stack.slice(), this.direction === Direction.Forward ? Direction.Backward : Direction.Forward);
  }
  next() {
    const entry = this.entry;
    this.count++;
    if (this.direction === Direction.Forward) {
      this.moveNext();
    } else {
      this.movePrev();
    }
    switch (entry._tag) {
      case "None": {
        return {
          done: true,
          value: this.count
        };
      }
      case "Some": {
        return {
          done: false,
          value: entry.value
        };
      }
    }
  }
  get key() {
    if (this.stack.length > 0) {
      return some2(this.stack[this.stack.length - 1].key);
    }
    return none2();
  }
  get value() {
    if (this.stack.length > 0) {
      return some2(this.stack[this.stack.length - 1].value);
    }
    return none2();
  }
  get entry() {
    return map(last(this.stack), (node) => [node.key, node.value]);
  }
  get index() {
    let idx = 0;
    const stack = this.stack;
    if (stack.length === 0) {
      const r = this.self._root;
      if (r != null) {
        return r.count;
      }
      return 0;
    } else if (stack[stack.length - 1].left != null) {
      idx = stack[stack.length - 1].left.count;
    }
    for (let s = stack.length - 2;s >= 0; --s) {
      if (stack[s + 1] === stack[s].right) {
        ++idx;
        if (stack[s].left != null) {
          idx += stack[s].left.count;
        }
      }
    }
    return idx;
  }
  moveNext() {
    const stack = this.stack;
    if (stack.length === 0) {
      return;
    }
    let n = stack[stack.length - 1];
    if (n.right != null) {
      n = n.right;
      while (n != null) {
        stack.push(n);
        n = n.left;
      }
    } else {
      stack.pop();
      while (stack.length > 0 && stack[stack.length - 1].right === n) {
        n = stack[stack.length - 1];
        stack.pop();
      }
    }
  }
  get hasNext() {
    const stack = this.stack;
    if (stack.length === 0) {
      return false;
    }
    if (stack[stack.length - 1].right != null) {
      return true;
    }
    for (let s = stack.length - 1;s > 0; --s) {
      if (stack[s - 1].left === stack[s]) {
        return true;
      }
    }
    return false;
  }
  movePrev() {
    const stack = this.stack;
    if (stack.length === 0) {
      return;
    }
    let n = stack[stack.length - 1];
    if (n != null && n.left != null) {
      n = n.left;
      while (n != null) {
        stack.push(n);
        n = n.right;
      }
    } else {
      stack.pop();
      while (stack.length > 0 && stack[stack.length - 1].left === n) {
        n = stack[stack.length - 1];
        stack.pop();
      }
    }
  }
  get hasPrev() {
    const stack = this.stack;
    if (stack.length === 0) {
      return false;
    }
    if (stack[stack.length - 1].left != null) {
      return true;
    }
    for (let s = stack.length - 1;s > 0; --s) {
      if (stack[s - 1].right === stack[s]) {
        return true;
      }
    }
    return false;
  }
}

// node_modules/effect/dist/esm/internal/redBlackTree/node.js
var Color = {
  Red: 0,
  Black: 1 << 0
};

// node_modules/effect/dist/esm/internal/redBlackTree.js
var RedBlackTreeSymbolKey = "effect/RedBlackTree";
var RedBlackTreeTypeId = /* @__PURE__ */ Symbol.for(RedBlackTreeSymbolKey);
var redBlackTreeVariance = {
  _Key: (_) => _,
  _Value: (_) => _
};
var RedBlackTreeProto = {
  [RedBlackTreeTypeId]: redBlackTreeVariance,
  [symbol]() {
    let hash2 = hash(RedBlackTreeSymbolKey);
    for (const item of this) {
      hash2 ^= pipe(hash(item[0]), combine(hash(item[1])));
    }
    return cached(this, hash2);
  },
  [symbol2](that) {
    if (isRedBlackTree(that)) {
      if ((this._root?.count ?? 0) !== (that._root?.count ?? 0)) {
        return false;
      }
      const entries2 = Array.from(that);
      return Array.from(this).every((itemSelf, i) => {
        const itemThat = entries2[i];
        return equals(itemSelf[0], itemThat[0]) && equals(itemSelf[1], itemThat[1]);
      });
    }
    return false;
  },
  [Symbol.iterator]() {
    const stack = [];
    let n = this._root;
    while (n != null) {
      stack.push(n);
      n = n.left;
    }
    return new RedBlackTreeIterator(this, stack, Direction.Forward);
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "RedBlackTree",
      values: Array.from(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isRedBlackTree = (u) => hasProperty(u, RedBlackTreeTypeId);
var keysForward = (self) => keys3(self, Direction.Forward);
var keys3 = (self, direction) => {
  const begin = self[Symbol.iterator]();
  let count = 0;
  return {
    [Symbol.iterator]: () => keys3(self, direction),
    next: () => {
      count++;
      const entry = begin.key;
      if (direction === Direction.Forward) {
        begin.moveNext();
      } else {
        begin.movePrev();
      }
      switch (entry._tag) {
        case "None": {
          return {
            done: true,
            value: count
          };
        }
        case "Some": {
          return {
            done: false,
            value: entry.value
          };
        }
      }
    }
  };
};

// node_modules/effect/dist/esm/RedBlackTree.js
var keys4 = keysForward;

// node_modules/effect/dist/esm/SortedSet.js
var TypeId11 = /* @__PURE__ */ Symbol.for("effect/SortedSet");
var SortedSetProto = {
  [TypeId11]: {
    _A: (_) => _
  },
  [symbol]() {
    return pipe(hash(this.keyTree), combine(hash(TypeId11)), cached(this));
  },
  [symbol2](that) {
    return isSortedSet(that) && equals(this.keyTree, that.keyTree);
  },
  [Symbol.iterator]() {
    return keys4(this.keyTree);
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "SortedSet",
      values: Array.from(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isSortedSet = (u) => hasProperty(u, TypeId11);

// node_modules/effect/dist/esm/internal/supervisor.js
var SupervisorSymbolKey = "effect/Supervisor";
var SupervisorTypeId = /* @__PURE__ */ Symbol.for(SupervisorSymbolKey);
var supervisorVariance = {
  _T: (_) => _
};

class ProxySupervisor {
  underlying;
  value0;
  [SupervisorTypeId] = supervisorVariance;
  constructor(underlying, value0) {
    this.underlying = underlying;
    this.value0 = value0;
  }
  get value() {
    return this.value0;
  }
  onStart(context2, effect, parent, fiber) {
    this.underlying.onStart(context2, effect, parent, fiber);
  }
  onEnd(value, fiber) {
    this.underlying.onEnd(value, fiber);
  }
  onEffect(fiber, effect) {
    this.underlying.onEffect(fiber, effect);
  }
  onSuspend(fiber) {
    this.underlying.onSuspend(fiber);
  }
  onResume(fiber) {
    this.underlying.onResume(fiber);
  }
  map(f) {
    return new ProxySupervisor(this, pipe(this.value, map9(f)));
  }
  zip(right3) {
    return new Zip(this, right3);
  }
}

class Zip {
  left;
  right;
  _tag = "Zip";
  [SupervisorTypeId] = supervisorVariance;
  constructor(left3, right3) {
    this.left = left3;
    this.right = right3;
  }
  get value() {
    return zip2(this.left.value, this.right.value);
  }
  onStart(context2, effect, parent, fiber) {
    this.left.onStart(context2, effect, parent, fiber);
    this.right.onStart(context2, effect, parent, fiber);
  }
  onEnd(value, fiber) {
    this.left.onEnd(value, fiber);
    this.right.onEnd(value, fiber);
  }
  onEffect(fiber, effect) {
    this.left.onEffect(fiber, effect);
    this.right.onEffect(fiber, effect);
  }
  onSuspend(fiber) {
    this.left.onSuspend(fiber);
    this.right.onSuspend(fiber);
  }
  onResume(fiber) {
    this.left.onResume(fiber);
    this.right.onResume(fiber);
  }
  map(f) {
    return new ProxySupervisor(this, pipe(this.value, map9(f)));
  }
  zip(right3) {
    return new Zip(this, right3);
  }
}
var isZip = (self) => hasProperty(self, SupervisorTypeId) && isTagged(self, "Zip");

class Track {
  [SupervisorTypeId] = supervisorVariance;
  fibers = new Set;
  get value() {
    return sync(() => Array.from(this.fibers));
  }
  onStart(_context, _effect, _parent, fiber) {
    this.fibers.add(fiber);
  }
  onEnd(_value, fiber) {
    this.fibers.delete(fiber);
  }
  onEffect(_fiber, _effect) {}
  onSuspend(_fiber) {}
  onResume(_fiber) {}
  map(f) {
    return new ProxySupervisor(this, pipe(this.value, map9(f)));
  }
  zip(right3) {
    return new Zip(this, right3);
  }
  onRun(execution, _fiber) {
    return execution();
  }
}

class Const {
  effect;
  [SupervisorTypeId] = supervisorVariance;
  constructor(effect) {
    this.effect = effect;
  }
  get value() {
    return this.effect;
  }
  onStart(_context, _effect, _parent, _fiber) {}
  onEnd(_value, _fiber) {}
  onEffect(_fiber, _effect) {}
  onSuspend(_fiber) {}
  onResume(_fiber) {}
  map(f) {
    return new ProxySupervisor(this, pipe(this.value, map9(f)));
  }
  zip(right3) {
    return new Zip(this, right3);
  }
  onRun(execution, _fiber) {
    return execution();
  }
}
var fromEffect = (effect) => {
  return new Const(effect);
};
var none7 = /* @__PURE__ */ globalValue("effect/Supervisor/none", () => fromEffect(unit));

// node_modules/effect/dist/esm/Differ.js
var make33 = make12;

// node_modules/effect/dist/esm/internal/supervisor/patch.js
var OP_EMPTY3 = "Empty";
var OP_ADD_SUPERVISOR = "AddSupervisor";
var OP_REMOVE_SUPERVISOR = "RemoveSupervisor";
var OP_AND_THEN2 = "AndThen";
var empty26 = {
  _tag: OP_EMPTY3
};
var combine11 = (self, that) => {
  return {
    _tag: OP_AND_THEN2,
    first: self,
    second: that
  };
};
var patch11 = (self, supervisor) => {
  return patchLoop(supervisor, of2(self));
};
var patchLoop = (_supervisor, _patches) => {
  let supervisor = _supervisor;
  let patches = _patches;
  while (isNonEmpty(patches)) {
    const head3 = headNonEmpty2(patches);
    switch (head3._tag) {
      case OP_EMPTY3: {
        patches = tailNonEmpty2(patches);
        break;
      }
      case OP_ADD_SUPERVISOR: {
        supervisor = supervisor.zip(head3.supervisor);
        patches = tailNonEmpty2(patches);
        break;
      }
      case OP_REMOVE_SUPERVISOR: {
        supervisor = removeSupervisor(supervisor, head3.supervisor);
        patches = tailNonEmpty2(patches);
        break;
      }
      case OP_AND_THEN2: {
        patches = prepend2(head3.first)(prepend2(head3.second)(tailNonEmpty2(patches)));
        break;
      }
    }
  }
  return supervisor;
};
var removeSupervisor = (self, that) => {
  if (equals(self, that)) {
    return none7;
  } else {
    if (isZip(self)) {
      return removeSupervisor(self.left, that).zip(removeSupervisor(self.right, that));
    } else {
      return self;
    }
  }
};
var toSet2 = (self) => {
  if (equals(self, none7)) {
    return empty7();
  } else {
    if (isZip(self)) {
      return pipe(toSet2(self.left), union3(toSet2(self.right)));
    } else {
      return make8(self);
    }
  }
};
var diff10 = (oldValue, newValue) => {
  if (equals(oldValue, newValue)) {
    return empty26;
  }
  const oldSupervisors = toSet2(oldValue);
  const newSupervisors = toSet2(newValue);
  const added = pipe(newSupervisors, difference2(oldSupervisors), reduce5(empty26, (patch12, supervisor) => combine11(patch12, {
    _tag: OP_ADD_SUPERVISOR,
    supervisor
  })));
  const removed = pipe(oldSupervisors, difference2(newSupervisors), reduce5(empty26, (patch12, supervisor) => combine11(patch12, {
    _tag: OP_REMOVE_SUPERVISOR,
    supervisor
  })));
  return combine11(added, removed);
};
var differ2 = /* @__PURE__ */ make33({
  empty: empty26,
  patch: patch11,
  combine: combine11,
  diff: diff10
});

// node_modules/effect/dist/esm/internal/fiberRuntime.js
var fiberStarted = /* @__PURE__ */ counter5("effect_fiber_started", {
  incremental: true
});
var fiberActive = /* @__PURE__ */ counter5("effect_fiber_active");
var fiberSuccesses = /* @__PURE__ */ counter5("effect_fiber_successes", {
  incremental: true
});
var fiberFailures = /* @__PURE__ */ counter5("effect_fiber_failures", {
  incremental: true
});
var fiberLifetimes = /* @__PURE__ */ tagged(/* @__PURE__ */ histogram5("effect_fiber_lifetimes", /* @__PURE__ */ exponential({
  start: 0.5,
  factor: 2,
  count: 35
})), "time_unit", "milliseconds");
var EvaluationSignalContinue = "Continue";
var EvaluationSignalDone = "Done";
var EvaluationSignalYieldNow = "Yield";
var runtimeFiberVariance = {
  _E: (_) => _,
  _A: (_) => _
};
var absurd = (_) => {
  throw new Error(`BUG: FiberRuntime - ${toStringUnknown(_)} - please report an issue at https://github.com/Effect-TS/effect/issues`);
};
var YieldedOp = /* @__PURE__ */ Symbol.for("effect/internal/fiberRuntime/YieldedOp");
var yieldedOpChannel = /* @__PURE__ */ globalValue("effect/internal/fiberRuntime/yieldedOpChannel", () => ({
  currentOp: null
}));
var contOpSuccess = {
  [OP_ON_SUCCESS]: (_, cont, value) => {
    return cont.effect_instruction_i1(value);
  },
  ["OnStep"]: (_, _cont, value) => {
    return exitSucceed(exitSucceed(value));
  },
  [OP_ON_SUCCESS_AND_FAILURE]: (_, cont, value) => {
    return cont.effect_instruction_i2(value);
  },
  [OP_REVERT_FLAGS]: (self, cont, value) => {
    self.patchRuntimeFlags(self._runtimeFlags, cont.patch);
    if (interruptible(self._runtimeFlags) && self.isInterrupted()) {
      return exitFailCause(self.getInterruptedCause());
    } else {
      return exitSucceed(value);
    }
  },
  [OP_WHILE]: (self, cont, value) => {
    cont.effect_instruction_i2(value);
    if (cont.effect_instruction_i0()) {
      self.pushStack(cont);
      return cont.effect_instruction_i1();
    } else {
      return unit;
    }
  }
};
var drainQueueWhileRunningTable = {
  [OP_INTERRUPT_SIGNAL]: (self, runtimeFlags2, cur, message) => {
    self.processNewInterruptSignal(message.cause);
    return interruptible(runtimeFlags2) ? exitFailCause(message.cause) : cur;
  },
  [OP_RESUME]: (_self, _runtimeFlags, _cur, _message) => {
    throw new Error("It is illegal to have multiple concurrent run loops in a single fiber");
  },
  [OP_STATEFUL]: (self, runtimeFlags2, cur, message) => {
    message.onFiber(self, running2(runtimeFlags2));
    return cur;
  },
  [OP_YIELD_NOW]: (_self, _runtimeFlags, cur, _message) => {
    return flatMap7(yieldNow(), () => cur);
  }
};
var runBlockedRequests = (self) => forEachSequentialDiscard(flatten2(self), (requestsByRequestResolver) => forEachConcurrentDiscard(sequentialCollectionToChunk(requestsByRequestResolver), ([dataSource, sequential4]) => {
  const map11 = new Map;
  const arr = [];
  for (const block of sequential4) {
    arr.push(toReadonlyArray(block));
    for (const entry of block) {
      map11.set(entry.request, entry);
    }
  }
  const flat = arr.flat();
  return fiberRefLocally(invokeWithInterrupt(dataSource.runAll(arr), flat, () => flat.forEach((entry) => {
    entry.listeners.interrupted = true;
  })), currentRequestMap, map11);
}, false, false));

class FiberRuntime {
  [FiberTypeId] = fiberVariance;
  [RuntimeFiberTypeId] = runtimeFiberVariance;
  pipe() {
    return pipeArguments(this, arguments);
  }
  _fiberRefs;
  _fiberId;
  _runtimeFlags;
  _queue = new Array;
  _children = null;
  _observers = new Array;
  _running = false;
  _stack = [];
  _asyncInterruptor = null;
  _asyncBlockingOn = null;
  _exitValue = null;
  _steps = [];
  _supervisor;
  _scheduler;
  _tracer;
  currentOpCount = 0;
  isYielding = false;
  constructor(fiberId2, fiberRefs0, runtimeFlags0) {
    this._runtimeFlags = runtimeFlags0;
    this._fiberId = fiberId2;
    this._fiberRefs = fiberRefs0;
    this._supervisor = this.getFiberRef(currentSupervisor);
    this._scheduler = this.getFiberRef(currentScheduler);
    if (runtimeMetrics(runtimeFlags0)) {
      const tags = this.getFiberRef(currentMetricLabels);
      fiberStarted.unsafeUpdate(1, tags);
      fiberActive.unsafeUpdate(1, tags);
    }
    this._tracer = get2(this.getFiberRef(currentServices), tracerTag);
  }
  id() {
    return this._fiberId;
  }
  resume(effect) {
    this.tell(resume(effect));
  }
  get status() {
    return this.ask((_, status) => status);
  }
  get runtimeFlags() {
    return this.ask((state, status) => {
      if (isDone3(status)) {
        return state._runtimeFlags;
      }
      return status.runtimeFlags;
    });
  }
  scope() {
    return unsafeMake5(this);
  }
  get children() {
    return this.ask((fiber) => Array.from(fiber.getChildren()));
  }
  getChildren() {
    if (this._children === null) {
      this._children = new Set;
    }
    return this._children;
  }
  getInterruptedCause() {
    return this.getFiberRef(currentInterruptedCause);
  }
  fiberRefs() {
    return this.ask((fiber) => fiber.getFiberRefs());
  }
  ask(f) {
    return suspend(() => {
      const deferred = deferredUnsafeMake(this._fiberId);
      this.tell(stateful((fiber, status) => {
        deferredUnsafeDone(deferred, sync(() => f(fiber, status)));
      }));
      return deferredAwait(deferred);
    });
  }
  tell(message) {
    this._queue.push(message);
    if (!this._running) {
      this._running = true;
      this.drainQueueLaterOnExecutor();
    }
  }
  get await() {
    return async((resume2) => {
      const cb = (exit2) => resume2(succeed(exit2));
      this.tell(stateful((fiber, _) => {
        if (fiber._exitValue !== null) {
          cb(this._exitValue);
        } else {
          fiber.addObserver(cb);
        }
      }));
      return sync(() => this.tell(stateful((fiber, _) => {
        fiber.removeObserver(cb);
      })));
    }, this.id());
  }
  get inheritAll() {
    return withFiberRuntime((parentFiber, parentStatus) => {
      const parentFiberId = parentFiber.id();
      const parentFiberRefs = parentFiber.getFiberRefs();
      const parentRuntimeFlags = parentStatus.runtimeFlags;
      const childFiberRefs = this.getFiberRefs();
      const updatedFiberRefs = joinAs(parentFiberRefs, parentFiberId, childFiberRefs);
      parentFiber.setFiberRefs(updatedFiberRefs);
      const updatedRuntimeFlags = parentFiber.getFiberRef(currentRuntimeFlags);
      const patch12 = pipe(diff7(parentRuntimeFlags, updatedRuntimeFlags), exclude2(Interruption), exclude2(WindDown));
      return updateRuntimeFlags(patch12);
    });
  }
  get poll() {
    return sync(() => fromNullable(this._exitValue));
  }
  unsafePoll() {
    return this._exitValue;
  }
  interruptAsFork(fiberId2) {
    return sync(() => this.tell(interruptSignal(interrupt(fiberId2))));
  }
  unsafeInterruptAsFork(fiberId2) {
    this.tell(interruptSignal(interrupt(fiberId2)));
  }
  addObserver(observer) {
    if (this._exitValue !== null) {
      observer(this._exitValue);
    } else {
      this._observers.push(observer);
    }
  }
  removeObserver(observer) {
    this._observers = this._observers.filter((o) => o !== observer);
  }
  getFiberRefs() {
    this.setFiberRef(currentRuntimeFlags, this._runtimeFlags);
    return this._fiberRefs;
  }
  unsafeDeleteFiberRef(fiberRef) {
    this._fiberRefs = delete_(this._fiberRefs, fiberRef);
  }
  getFiberRef(fiberRef) {
    if (this._fiberRefs.locals.has(fiberRef)) {
      return this._fiberRefs.locals.get(fiberRef)[0][1];
    }
    return fiberRef.initial;
  }
  setFiberRef(fiberRef, value) {
    this._fiberRefs = updateAs(this._fiberRefs, {
      fiberId: this._fiberId,
      fiberRef,
      value
    });
    this.refreshRefCache();
  }
  refreshRefCache() {
    this._tracer = get2(this.getFiberRef(currentServices), tracerTag);
    this._supervisor = this.getFiberRef(currentSupervisor);
    this._scheduler = this.getFiberRef(currentScheduler);
  }
  setFiberRefs(fiberRefs3) {
    this._fiberRefs = fiberRefs3;
    this.refreshRefCache();
  }
  addChild(child) {
    this.getChildren().add(child);
  }
  removeChild(child) {
    this.getChildren().delete(child);
  }
  drainQueueOnCurrentThread() {
    let recurse = true;
    while (recurse) {
      let evaluationSignal = EvaluationSignalContinue;
      const prev = globalThis[currentFiberURI];
      globalThis[currentFiberURI] = this;
      try {
        while (evaluationSignal === EvaluationSignalContinue) {
          evaluationSignal = this._queue.length === 0 ? EvaluationSignalDone : this.evaluateMessageWhileSuspended(this._queue.splice(0, 1)[0]);
        }
      } finally {
        this._running = false;
        globalThis[currentFiberURI] = prev;
      }
      if (this._queue.length > 0 && !this._running) {
        this._running = true;
        if (evaluationSignal === EvaluationSignalYieldNow) {
          this.drainQueueLaterOnExecutor();
          recurse = false;
        } else {
          recurse = true;
        }
      } else {
        recurse = false;
      }
    }
  }
  drainQueueLaterOnExecutor() {
    this._scheduler.scheduleTask(this.run, this.getFiberRef(currentSchedulingPriority));
  }
  drainQueueWhileRunning(runtimeFlags2, cur0) {
    let cur = cur0;
    while (this._queue.length > 0) {
      const message = this._queue.splice(0, 1)[0];
      cur = drainQueueWhileRunningTable[message._tag](this, runtimeFlags2, cur, message);
    }
    return cur;
  }
  isInterrupted() {
    return !isEmpty5(this.getFiberRef(currentInterruptedCause));
  }
  addInterruptedCause(cause) {
    const oldSC = this.getFiberRef(currentInterruptedCause);
    this.setFiberRef(currentInterruptedCause, sequential(oldSC, cause));
  }
  processNewInterruptSignal(cause) {
    this.addInterruptedCause(cause);
    this.sendInterruptSignalToAllChildren();
  }
  sendInterruptSignalToAllChildren() {
    if (this._children === null || this._children.size === 0) {
      return false;
    }
    let told = false;
    for (const child of this._children) {
      child.tell(interruptSignal(interrupt(this.id())));
      told = true;
    }
    return told;
  }
  interruptAllChildren() {
    if (this.sendInterruptSignalToAllChildren()) {
      const it = this._children.values();
      this._children = null;
      let isDone4 = false;
      const body = () => {
        const next = it.next();
        if (!next.done) {
          return asUnit(next.value.await);
        } else {
          return sync(() => {
            isDone4 = true;
          });
        }
      };
      return whileLoop({
        while: () => !isDone4,
        body,
        step: () => {}
      });
    }
    return null;
  }
  reportExitValue(exit2) {
    if (runtimeMetrics(this._runtimeFlags)) {
      const tags = this.getFiberRef(currentMetricLabels);
      const startTimeMillis = this.id().startTimeMillis;
      const endTimeMillis = Date.now();
      fiberLifetimes.unsafeUpdate(endTimeMillis - startTimeMillis, tags);
      fiberActive.unsafeUpdate(-1, tags);
      switch (exit2._tag) {
        case OP_SUCCESS: {
          fiberSuccesses.unsafeUpdate(1, tags);
          break;
        }
        case OP_FAILURE: {
          fiberFailures.unsafeUpdate(1, tags);
          break;
        }
      }
    }
    if (exit2._tag === "Failure") {
      const level = this.getFiberRef(currentUnhandledErrorLogLevel);
      if (!isInterruptedOnly(exit2.cause) && level._tag === "Some") {
        this.log("Fiber terminated with an unhandled error", exit2.cause, level);
      }
    }
  }
  setExitValue(exit2) {
    this._exitValue = exit2;
    this.reportExitValue(exit2);
    for (let i = this._observers.length - 1;i >= 0; i--) {
      this._observers[i](exit2);
    }
  }
  getLoggers() {
    return this.getFiberRef(currentLoggers);
  }
  log(message, cause, overrideLogLevel) {
    const logLevel = isSome2(overrideLogLevel) ? overrideLogLevel.value : this.getFiberRef(currentLogLevel);
    const minimumLogLevel = this.getFiberRef(currentMinimumLogLevel);
    if (greaterThan2(minimumLogLevel, logLevel)) {
      return;
    }
    const spans = this.getFiberRef(currentLogSpan);
    const annotations = this.getFiberRef(currentLogAnnotations);
    const loggers = this.getLoggers();
    const contextMap = this.getFiberRefs();
    if (size3(loggers) > 0) {
      const clockService = get2(this.getFiberRef(currentServices), clockTag);
      const date = new Date(clockService.unsafeCurrentTimeMillis());
      for (const logger of loggers) {
        logger.log({
          fiberId: this.id(),
          logLevel,
          message,
          cause,
          context: contextMap,
          spans,
          annotations,
          date
        });
      }
    }
  }
  evaluateMessageWhileSuspended(message) {
    switch (message._tag) {
      case OP_YIELD_NOW: {
        return EvaluationSignalYieldNow;
      }
      case OP_INTERRUPT_SIGNAL: {
        this.processNewInterruptSignal(message.cause);
        if (this._asyncInterruptor !== null) {
          this._asyncInterruptor(exitFailCause(message.cause));
          this._asyncInterruptor = null;
        }
        return EvaluationSignalContinue;
      }
      case OP_RESUME: {
        this._asyncInterruptor = null;
        this._asyncBlockingOn = null;
        this.evaluateEffect(message.effect);
        return EvaluationSignalContinue;
      }
      case OP_STATEFUL: {
        message.onFiber(this, this._exitValue !== null ? done3 : suspended2(this._runtimeFlags, this._asyncBlockingOn));
        return EvaluationSignalContinue;
      }
      default: {
        return absurd(message);
      }
    }
  }
  evaluateEffect(effect0) {
    this._supervisor.onResume(this);
    try {
      let effect = interruptible(this._runtimeFlags) && this.isInterrupted() ? exitFailCause(this.getInterruptedCause()) : effect0;
      while (effect !== null) {
        const eff = effect;
        const exit2 = this.runLoop(eff);
        if (exit2 === YieldedOp) {
          const op = yieldedOpChannel.currentOp;
          yieldedOpChannel.currentOp = null;
          if (op._op === OP_YIELD) {
            if (cooperativeYielding(this._runtimeFlags)) {
              this.tell(yieldNow2());
              this.tell(resume(exitUnit));
              effect = null;
            } else {
              effect = exitUnit;
            }
          } else if (op._op === OP_ASYNC) {
            effect = null;
          }
        } else {
          this._runtimeFlags = pipe(this._runtimeFlags, enable2(WindDown));
          const interruption2 = this.interruptAllChildren();
          if (interruption2 !== null) {
            effect = flatMap7(interruption2, () => exit2);
          } else {
            if (this._queue.length === 0) {
              this.setExitValue(exit2);
            } else {
              this.tell(resume(exit2));
            }
            effect = null;
          }
        }
      }
    } finally {
      this._supervisor.onSuspend(this);
    }
  }
  start(effect) {
    if (!this._running) {
      this._running = true;
      const prev = globalThis[currentFiberURI];
      globalThis[currentFiberURI] = this;
      try {
        this.evaluateEffect(effect);
      } finally {
        this._running = false;
        globalThis[currentFiberURI] = prev;
        if (this._queue.length > 0) {
          this.drainQueueLaterOnExecutor();
        }
      }
    } else {
      this.tell(resume(effect));
    }
  }
  startFork(effect) {
    this.tell(resume(effect));
  }
  patchRuntimeFlags(oldRuntimeFlags, patch12) {
    const newRuntimeFlags = patch7(oldRuntimeFlags, patch12);
    globalThis[currentFiberURI] = this;
    this._runtimeFlags = newRuntimeFlags;
    return newRuntimeFlags;
  }
  initiateAsync(runtimeFlags2, asyncRegister) {
    let alreadyCalled = false;
    const callback = (effect) => {
      if (!alreadyCalled) {
        alreadyCalled = true;
        this.tell(resume(effect));
      }
    };
    if (interruptible(runtimeFlags2)) {
      this._asyncInterruptor = callback;
    }
    try {
      asyncRegister(callback);
    } catch (e) {
      callback(failCause(die(e)));
    }
  }
  pushStack(cont) {
    this._stack.push(cont);
    if (cont._op === "OnStep") {
      this._steps.push({
        refs: this.getFiberRefs(),
        flags: this._runtimeFlags
      });
    }
  }
  popStack() {
    const item = this._stack.pop();
    if (item) {
      if (item._op === "OnStep") {
        this._steps.pop();
      }
      return item;
    }
    return;
  }
  getNextSuccessCont() {
    let frame = this.popStack();
    while (frame) {
      if (frame._op !== OP_ON_FAILURE) {
        return frame;
      }
      frame = this.popStack();
    }
  }
  getNextFailCont() {
    let frame = this.popStack();
    while (frame) {
      if (frame._op !== OP_ON_SUCCESS && frame._op !== OP_WHILE) {
        return frame;
      }
      frame = this.popStack();
    }
  }
  [OP_TAG](op) {
    return map9(fiberRefGet(currentContext), (context2) => unsafeGet2(context2, op));
  }
  ["Left"](op) {
    return fail2(op.left);
  }
  ["None"](_) {
    return fail2(new NoSuchElementException);
  }
  ["Right"](op) {
    return exitSucceed(op.right);
  }
  ["Some"](op) {
    return exitSucceed(op.value);
  }
  [OP_SYNC](op) {
    const value = op.effect_instruction_i0();
    const cont = this.getNextSuccessCont();
    if (cont !== undefined) {
      if (!(cont._op in contOpSuccess)) {
        absurd(cont);
      }
      return contOpSuccess[cont._op](this, cont, value);
    } else {
      yieldedOpChannel.currentOp = exitSucceed(value);
      return YieldedOp;
    }
  }
  [OP_SUCCESS](op) {
    const oldCur = op;
    const cont = this.getNextSuccessCont();
    if (cont !== undefined) {
      if (!(cont._op in contOpSuccess)) {
        absurd(cont);
      }
      return contOpSuccess[cont._op](this, cont, oldCur.effect_instruction_i0);
    } else {
      yieldedOpChannel.currentOp = oldCur;
      return YieldedOp;
    }
  }
  [OP_FAILURE](op) {
    const cause = op.effect_instruction_i0;
    const cont = this.getNextFailCont();
    if (cont !== undefined) {
      switch (cont._op) {
        case OP_ON_FAILURE:
        case OP_ON_SUCCESS_AND_FAILURE: {
          if (!(interruptible(this._runtimeFlags) && this.isInterrupted())) {
            return cont.effect_instruction_i1(cause);
          } else {
            return exitFailCause(stripFailures(cause));
          }
        }
        case "OnStep": {
          if (!(interruptible(this._runtimeFlags) && this.isInterrupted())) {
            return exitSucceed(exitFailCause(cause));
          } else {
            return exitFailCause(stripFailures(cause));
          }
        }
        case OP_REVERT_FLAGS: {
          this.patchRuntimeFlags(this._runtimeFlags, cont.patch);
          if (interruptible(this._runtimeFlags) && this.isInterrupted()) {
            return exitFailCause(sequential(cause, this.getInterruptedCause()));
          } else {
            return exitFailCause(cause);
          }
        }
        default: {
          absurd(cont);
        }
      }
    } else {
      yieldedOpChannel.currentOp = exitFailCause(cause);
      return YieldedOp;
    }
  }
  [OP_WITH_RUNTIME](op) {
    return op.effect_instruction_i0(this, running2(this._runtimeFlags));
  }
  ["Blocked"](op) {
    const refs = this.getFiberRefs();
    const flags = this._runtimeFlags;
    if (this._steps.length > 0) {
      const frames = [];
      const snap = this._steps[this._steps.length - 1];
      let frame = this.popStack();
      while (frame && frame._op !== "OnStep") {
        frames.push(frame);
        frame = this.popStack();
      }
      this.setFiberRefs(snap.refs);
      this._runtimeFlags = snap.flags;
      const patchRefs = diff9(snap.refs, refs);
      const patchFlags = diff7(snap.flags, flags);
      return exitSucceed(blocked(op.effect_instruction_i0, withFiberRuntime((newFiber) => {
        while (frames.length > 0) {
          newFiber.pushStack(frames.pop());
        }
        newFiber.setFiberRefs(patch10(newFiber.id(), newFiber.getFiberRefs())(patchRefs));
        newFiber._runtimeFlags = patch7(patchFlags)(newFiber._runtimeFlags);
        return op.effect_instruction_i1;
      })));
    }
    return uninterruptibleMask((restore) => flatMap7(forkDaemon(runRequestBlock(op.effect_instruction_i0)), () => restore(op.effect_instruction_i1)));
  }
  ["RunBlocked"](op) {
    return runBlockedRequests(op.effect_instruction_i0);
  }
  [OP_UPDATE_RUNTIME_FLAGS](op) {
    const updateFlags = op.effect_instruction_i0;
    const oldRuntimeFlags = this._runtimeFlags;
    const newRuntimeFlags = patch7(oldRuntimeFlags, updateFlags);
    if (interruptible(newRuntimeFlags) && this.isInterrupted()) {
      return exitFailCause(this.getInterruptedCause());
    } else {
      this.patchRuntimeFlags(this._runtimeFlags, updateFlags);
      if (op.effect_instruction_i1) {
        const revertFlags = diff7(newRuntimeFlags, oldRuntimeFlags);
        this.pushStack(new RevertFlags(revertFlags, op));
        return op.effect_instruction_i1(oldRuntimeFlags);
      } else {
        return exitUnit;
      }
    }
  }
  [OP_ON_SUCCESS](op) {
    this.pushStack(op);
    return op.effect_instruction_i0;
  }
  ["OnStep"](op) {
    this.pushStack(op);
    return op.effect_instruction_i0;
  }
  [OP_ON_FAILURE](op) {
    this.pushStack(op);
    return op.effect_instruction_i0;
  }
  [OP_ON_SUCCESS_AND_FAILURE](op) {
    this.pushStack(op);
    return op.effect_instruction_i0;
  }
  [OP_ASYNC](op) {
    this._asyncBlockingOn = op.effect_instruction_i1;
    this.initiateAsync(this._runtimeFlags, op.effect_instruction_i0);
    yieldedOpChannel.currentOp = op;
    return YieldedOp;
  }
  [OP_YIELD](op) {
    this.isYielding = false;
    yieldedOpChannel.currentOp = op;
    return YieldedOp;
  }
  [OP_WHILE](op) {
    const check = op.effect_instruction_i0;
    const body = op.effect_instruction_i1;
    if (check()) {
      this.pushStack(op);
      return body();
    } else {
      return exitUnit;
    }
  }
  [OP_COMMIT](op) {
    return op.commit();
  }
  runLoop(effect0) {
    let cur = effect0;
    this.currentOpCount = 0;
    while (true) {
      if ((this._runtimeFlags & OpSupervision) !== 0) {
        this._supervisor.onEffect(this, cur);
      }
      if (this._queue.length > 0) {
        cur = this.drainQueueWhileRunning(this._runtimeFlags, cur);
      }
      if (!this.isYielding) {
        this.currentOpCount += 1;
        const shouldYield = this._scheduler.shouldYield(this);
        if (shouldYield !== false) {
          this.isYielding = true;
          this.currentOpCount = 0;
          const oldCur = cur;
          cur = flatMap7(yieldNow({
            priority: shouldYield
          }), () => oldCur);
        }
      }
      try {
        if (!("_op" in cur) || !(cur._op in this)) {
          absurd(cur);
        }
        cur = this._tracer.context(() => {
          if (getCurrentVersion() !== cur[EffectTypeId3]._V) {
            return dieMessage(`Cannot execute an Effect versioned ${cur[EffectTypeId3]._V} with a Runtime of version ${getCurrentVersion()}`);
          }
          return this[cur._op](cur);
        }, this);
        if (cur === YieldedOp) {
          const op = yieldedOpChannel.currentOp;
          if (op._op === OP_YIELD || op._op === OP_ASYNC) {
            return YieldedOp;
          }
          yieldedOpChannel.currentOp = null;
          return op._op === OP_SUCCESS || op._op === OP_FAILURE ? op : exitFailCause(die(op));
        }
      } catch (e) {
        if (isEffectError(e)) {
          cur = exitFailCause(e.cause);
        } else if (isInterruptedException(e)) {
          cur = exitFailCause(sequential(die(e), interrupt(none4)));
        } else {
          cur = exitFailCause(die(e));
        }
      }
    }
  }
  run = () => {
    this.drainQueueOnCurrentThread();
  };
}
var currentMinimumLogLevel = /* @__PURE__ */ globalValue("effect/FiberRef/currentMinimumLogLevel", () => fiberRefUnsafeMake(fromLiteral("Info")));
var loggerWithConsoleLog = (self) => makeLogger((opts) => {
  const services = getOrDefault2(opts.context, currentServices);
  get2(services, consoleTag).unsafe.log(self.log(opts));
});
var defaultLogger = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/Logger/defaultLogger"), () => loggerWithConsoleLog(stringLogger));
var tracerLogger = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/Logger/tracerLogger"), () => makeLogger(({
  annotations,
  cause,
  context: context2,
  fiberId: fiberId2,
  logLevel,
  message
}) => {
  const span2 = flatMap(get8(context2, currentContext), getOption2(spanTag));
  const clockService = map(get8(context2, currentServices), (_) => get2(_, clockTag));
  if (span2._tag === "None" || span2.value._tag === "ExternalSpan" || clockService._tag === "None") {
    return;
  }
  const attributes = Object.fromEntries(map6(annotations, toStringUnknown));
  attributes["effect.fiberId"] = threadName2(fiberId2);
  attributes["effect.logLevel"] = logLevel.label;
  if (cause !== null && cause._tag !== "Empty") {
    attributes["effect.cause"] = pretty(cause);
  }
  span2.value.event(String(message), clockService.value.unsafeCurrentTimeNanos(), attributes);
}));
var currentLoggers = /* @__PURE__ */ globalValue(/* @__PURE__ */ Symbol.for("effect/FiberRef/currentLoggers"), () => fiberRefUnsafeMakeHashSet(make8(defaultLogger, tracerLogger)));
var acquireRelease = /* @__PURE__ */ dual((args) => isEffect(args[0]), (acquire, release) => uninterruptible(tap(acquire, (a) => addFinalizer((exit2) => release(a, exit2)))));
var addFinalizer = (finalizer) => withFiberRuntime((runtime2) => {
  const acquireRefs = runtime2.getFiberRefs();
  const acquireFlags = runtime2._runtimeFlags;
  return flatMap7(scope, (scope) => scopeAddFinalizerExit(scope, (exit2) => withFiberRuntime((runtimeFinalizer) => {
    const preRefs = runtimeFinalizer.getFiberRefs();
    const preFlags = runtimeFinalizer._runtimeFlags;
    const patchRefs = diff9(preRefs, acquireRefs);
    const patchFlags = diff7(preFlags, acquireFlags);
    const inverseRefs = diff9(acquireRefs, preRefs);
    runtimeFinalizer.setFiberRefs(patch10(patchRefs, runtimeFinalizer.id(), acquireRefs));
    return ensuring(withRuntimeFlags(finalizer(exit2), patchFlags), sync(() => {
      runtimeFinalizer.setFiberRefs(patch10(inverseRefs, runtimeFinalizer.id(), runtimeFinalizer.getFiberRefs()));
    }));
  })));
});
var allResolveInput = (input) => {
  if (Array.isArray(input) || isIterable(input)) {
    return [input, none2()];
  }
  const keys5 = Object.keys(input);
  const size7 = keys5.length;
  return [keys5.map((k) => input[k]), some2((values3) => {
    const res = {};
    for (let i = 0;i < size7; i++) {
      res[keys5[i]] = values3[i];
    }
    return res;
  })];
};
var allValidate = (effects, reconcile, options) => {
  const eitherEffects = [];
  for (const effect of effects) {
    eitherEffects.push(either2(effect));
  }
  return flatMap7(forEach6(eitherEffects, identity, {
    concurrency: options?.concurrency,
    batching: options?.batching
  }), (eithers) => {
    const none8 = none2();
    const size7 = eithers.length;
    const errors = new Array(size7);
    const successes = new Array(size7);
    let errored = false;
    for (let i = 0;i < size7; i++) {
      const either3 = eithers[i];
      if (either3._tag === "Left") {
        errors[i] = some2(either3.left);
        errored = true;
      } else {
        successes[i] = either3.right;
        errors[i] = none8;
      }
    }
    if (errored) {
      return reconcile._tag === "Some" ? fail2(reconcile.value(errors)) : fail2(errors);
    } else if (options?.discard) {
      return unit;
    }
    return reconcile._tag === "Some" ? succeed(reconcile.value(successes)) : succeed(successes);
  });
};
var allEither = (effects, reconcile, options) => {
  const eitherEffects = [];
  for (const effect of effects) {
    eitherEffects.push(either2(effect));
  }
  if (options?.discard) {
    return forEach6(eitherEffects, identity, {
      concurrency: options?.concurrency,
      batching: options?.batching,
      discard: true
    });
  }
  return map9(forEach6(eitherEffects, identity, {
    concurrency: options?.concurrency,
    batching: options?.batching
  }), (eithers) => reconcile._tag === "Some" ? reconcile.value(eithers) : eithers);
};
var all3 = (arg, options) => {
  const [effects, reconcile] = allResolveInput(arg);
  if (options?.mode === "validate") {
    return allValidate(effects, reconcile, options);
  } else if (options?.mode === "either") {
    return allEither(effects, reconcile, options);
  }
  return reconcile._tag === "Some" ? map9(forEach6(effects, identity, options), reconcile.value) : forEach6(effects, identity, options);
};
var forEach6 = /* @__PURE__ */ dual((args) => isIterable(args[0]), (self, f, options) => withFiberRuntime((r) => {
  const isRequestBatchingEnabled = options?.batching === true || options?.batching === "inherit" && r.getFiberRef(currentRequestBatching);
  if (options?.discard) {
    return match7(options.concurrency, () => finalizersMask(sequential3)((restore) => isRequestBatchingEnabled ? forEachConcurrentDiscard(self, (a, i) => restore(f(a, i)), true, false, 1) : forEachSequentialDiscard(self, (a, i) => restore(f(a, i)))), () => finalizersMask(parallel3)((restore) => forEachConcurrentDiscard(self, (a, i) => restore(f(a, i)), isRequestBatchingEnabled, false)), (n) => finalizersMask(parallelN2(n))((restore) => forEachConcurrentDiscard(self, (a, i) => restore(f(a, i)), isRequestBatchingEnabled, false, n)));
  }
  return match7(options?.concurrency, () => finalizersMask(sequential3)((restore) => isRequestBatchingEnabled ? forEachParN(self, 1, (a, i) => restore(f(a, i)), true) : forEachSequential(self, (a, i) => restore(f(a, i)))), () => finalizersMask(parallel3)((restore) => forEachParUnbounded(self, (a, i) => restore(f(a, i)), isRequestBatchingEnabled)), (n) => finalizersMask(parallelN2(n))((restore) => forEachParN(self, n, (a, i) => restore(f(a, i)), isRequestBatchingEnabled)));
}));
var forEachParUnbounded = (self, f, batching) => suspend(() => {
  const as2 = fromIterable(self);
  const array4 = new Array(as2.length);
  const fn = (a, i) => flatMap7(f(a, i), (b) => sync(() => array4[i] = b));
  return zipRight(forEachConcurrentDiscard(as2, fn, batching, false), succeed(array4));
});
var forEachConcurrentDiscard = (self, f, batching, processAll, n) => uninterruptibleMask((restore) => transplant((graft) => withFiberRuntime((parent) => {
  let todos = Array.from(self).reverse();
  let target = todos.length;
  if (target === 0) {
    return unit;
  }
  let counter6 = 0;
  let interrupted = false;
  const fibersCount = n ? Math.min(todos.length, n) : todos.length;
  const fibers = new Set;
  const results = new Array;
  const interruptAll = () => fibers.forEach((fiber) => {
    fiber._scheduler.scheduleTask(() => {
      fiber.unsafeInterruptAsFork(parent.id());
    }, 0);
  });
  const startOrder = new Array;
  const joinOrder = new Array;
  const residual = new Array;
  const collectExits = () => {
    const exits = results.filter(({
      exit: exit2
    }) => exit2._tag === "Failure").sort((a, b) => a.index < b.index ? -1 : a.index === b.index ? 0 : 1).map(({
      exit: exit2
    }) => exit2);
    if (exits.length === 0) {
      exits.push(exitUnit);
    }
    return exits;
  };
  const runFiber = (eff, interruptImmediately = false) => {
    const runnable = uninterruptible(graft(eff));
    const fiber = unsafeForkUnstarted(runnable, parent, parent._runtimeFlags, globalScope);
    parent._scheduler.scheduleTask(() => {
      if (interruptImmediately) {
        fiber.unsafeInterruptAsFork(parent.id());
      }
      fiber.resume(runnable);
    }, 0);
    return fiber;
  };
  const onInterruptSignal = () => {
    if (!processAll) {
      target -= todos.length;
      todos = [];
    }
    interrupted = true;
    interruptAll();
  };
  const stepOrExit = batching ? step2 : exit;
  const processingFiber = runFiber(async((resume2) => {
    const pushResult = (res, index) => {
      if (res._op === "Blocked") {
        residual.push(res);
      } else {
        results.push({
          index,
          exit: res
        });
        if (res._op === "Failure" && !interrupted) {
          onInterruptSignal();
        }
      }
    };
    const next = () => {
      if (todos.length > 0) {
        const a = todos.pop();
        let index = counter6++;
        const returnNextElement = () => {
          const a2 = todos.pop();
          index = counter6++;
          return flatMap7(yieldNow(), () => flatMap7(stepOrExit(restore(f(a2, index))), onRes));
        };
        const onRes = (res) => {
          if (todos.length > 0) {
            pushResult(res, index);
            if (todos.length > 0) {
              return returnNextElement();
            }
          }
          return succeed(res);
        };
        const todo = flatMap7(stepOrExit(restore(f(a, index))), onRes);
        const fiber = runFiber(todo);
        startOrder.push(fiber);
        fibers.add(fiber);
        if (interrupted) {
          fiber._scheduler.scheduleTask(() => {
            fiber.unsafeInterruptAsFork(parent.id());
          }, 0);
        }
        fiber.addObserver((wrapped) => {
          let exit2;
          if (wrapped._op === "Failure") {
            exit2 = wrapped;
          } else {
            exit2 = wrapped.effect_instruction_i0;
          }
          joinOrder.push(fiber);
          fibers.delete(fiber);
          pushResult(exit2, index);
          if (results.length === target) {
            resume2(succeed(getOrElse(exitCollectAll(collectExits(), {
              parallel: true
            }), () => exitUnit)));
          } else if (residual.length + results.length === target) {
            const requests = residual.map((blocked2) => blocked2.effect_instruction_i0).reduce(par);
            resume2(succeed(blocked(requests, forEachConcurrentDiscard([getOrElse(exitCollectAll(collectExits(), {
              parallel: true
            }), () => exitUnit), ...residual.map((blocked2) => blocked2.effect_instruction_i1)], (i) => i, batching, true, n))));
          } else {
            next();
          }
        });
      }
    };
    for (let i = 0;i < fibersCount; i++) {
      next();
    }
  }));
  return asUnit(onExit(flatten3(restore(join2(processingFiber))), exitMatch({
    onFailure: () => {
      onInterruptSignal();
      const target2 = residual.length + 1;
      const concurrency = Math.min(typeof n === "number" ? n : residual.length, residual.length);
      const toPop = Array.from(residual);
      return async((cb) => {
        const exits = [];
        let count = 0;
        let index = 0;
        const check = (index2, hitNext) => (exit2) => {
          exits[index2] = exit2;
          count++;
          if (count === target2) {
            cb(getOrThrow(exitCollectAll(exits, {
              parallel: true
            })));
          }
          if (toPop.length > 0 && hitNext) {
            next();
          }
        };
        const next = () => {
          runFiber(toPop.pop(), true).addObserver(check(index, true));
          index++;
        };
        processingFiber.addObserver(check(index, false));
        index++;
        for (let i = 0;i < concurrency; i++) {
          next();
        }
      });
    },
    onSuccess: () => forEachSequential(joinOrder, (f2) => f2.inheritAll)
  })));
})));
var forEachParN = (self, n, f, batching) => suspend(() => {
  const as2 = fromIterable(self);
  const array4 = new Array(as2.length);
  const fn = (a, i) => map9(f(a, i), (b) => array4[i] = b);
  return zipRight(forEachConcurrentDiscard(as2, fn, batching, false, n), succeed(array4));
});
var fork = (self) => withFiberRuntime((state, status) => succeed(unsafeFork(self, state, status.runtimeFlags)));
var forkDaemon = (self) => forkWithScopeOverride(self, globalScope);
var unsafeFork = (effect, parentFiber, parentRuntimeFlags, overrideScope = null) => {
  const childFiber = unsafeMakeChildFiber(effect, parentFiber, parentRuntimeFlags, overrideScope);
  childFiber.resume(effect);
  return childFiber;
};
var unsafeForkUnstarted = (effect, parentFiber, parentRuntimeFlags, overrideScope = null) => {
  const childFiber = unsafeMakeChildFiber(effect, parentFiber, parentRuntimeFlags, overrideScope);
  return childFiber;
};
var unsafeMakeChildFiber = (effect, parentFiber, parentRuntimeFlags, overrideScope = null) => {
  const childId = unsafeMake2();
  const parentFiberRefs = parentFiber.getFiberRefs();
  const childFiberRefs = forkAs(parentFiberRefs, childId);
  const childFiber = new FiberRuntime(childId, childFiberRefs, parentRuntimeFlags);
  const childContext = getOrDefault(childFiberRefs, currentContext);
  const supervisor = childFiber._supervisor;
  supervisor.onStart(childContext, effect, some2(parentFiber), childFiber);
  childFiber.addObserver((exit2) => supervisor.onEnd(exit2, childFiber));
  const parentScope = overrideScope !== null ? overrideScope : pipe(parentFiber.getFiberRef(currentForkScopeOverride), getOrElse(() => parentFiber.scope()));
  parentScope.add(parentRuntimeFlags, childFiber);
  return childFiber;
};
var forkWithScopeOverride = (self, scopeOverride) => withFiberRuntime((parentFiber, parentStatus) => succeed(unsafeFork(self, parentFiber, parentStatus.runtimeFlags, scopeOverride)));
var parallelFinalizers = (self) => contextWithEffect((context2) => match(getOption2(context2, scopeTag), {
  onNone: () => self,
  onSome: (scope) => {
    switch (scope.strategy._tag) {
      case "Parallel":
        return self;
      case "Sequential":
      case "ParallelN":
        return flatMap7(scopeFork(scope, parallel3), (inner) => scopeExtend(self, inner));
    }
  }
}));
var parallelNFinalizers = (parallelism) => (self) => contextWithEffect((context2) => match(getOption2(context2, scopeTag), {
  onNone: () => self,
  onSome: (scope) => {
    if (scope.strategy._tag === "ParallelN" && scope.strategy.parallelism === parallelism) {
      return self;
    }
    return flatMap7(scopeFork(scope, parallelN2(parallelism)), (inner) => scopeExtend(self, inner));
  }
}));
var finalizersMask = (strategy) => (self) => contextWithEffect((context2) => match(getOption2(context2, scopeTag), {
  onNone: () => self(identity),
  onSome: (scope) => {
    const patch12 = strategy._tag === "Parallel" ? parallelFinalizers : strategy._tag === "Sequential" ? sequentialFinalizers : parallelNFinalizers(strategy.parallelism);
    switch (scope.strategy._tag) {
      case "Parallel":
        return patch12(self(parallelFinalizers));
      case "Sequential":
        return patch12(self(sequentialFinalizers));
      case "ParallelN":
        return patch12(self(parallelNFinalizers(scope.strategy.parallelism)));
    }
  }
}));
var scopeWith = (f) => flatMap7(scopeTag, f);
var scopedEffect = (effect) => flatMap7(scopeMake(), (scope) => scopeUse(effect, scope));
var sequentialFinalizers = (self) => contextWithEffect((context2) => match(getOption2(context2, scopeTag), {
  onNone: () => self,
  onSome: (scope) => {
    switch (scope.strategy._tag) {
      case "Sequential":
        return self;
      case "Parallel":
      case "ParallelN":
        return flatMap7(scopeFork(scope, sequential3), (inner) => scopeExtend(self, inner));
    }
  }
}));
var zipOptions = /* @__PURE__ */ dual((args) => isEffect(args[1]), (self, that, options) => zipWithOptions(self, that, (a, b) => [a, b], options));
var zipLeftOptions = /* @__PURE__ */ dual((args) => isEffect(args[1]), (self, that, options) => {
  if (options?.concurrent !== true && (options?.batching === undefined || options.batching === false)) {
    return zipLeft(self, that);
  }
  return zipWithOptions(self, that, (a, _) => a, options);
});
var zipRightOptions = /* @__PURE__ */ dual((args) => isEffect(args[1]), (self, that, options) => {
  if (options?.concurrent !== true && (options?.batching === undefined || options.batching === false)) {
    return zipRight(self, that);
  }
  return zipWithOptions(self, that, (_, b) => b, options);
});
var zipWithOptions = /* @__PURE__ */ dual((args) => isEffect(args[1]), (self, that, f, options) => map9(all3([self, that], {
  concurrency: options?.concurrent ? 2 : 1,
  batching: options?.batching
}), ([a, a2]) => f(a, a2)));
var scopeTag = /* @__PURE__ */ GenericTag("effect/Scope");
var scope = scopeTag;
var scopeUnsafeAddFinalizer = (scope2, fin) => {
  if (scope2.state._tag === "Open") {
    scope2.state.finalizers.add(fin);
  }
};
var ScopeImplProto = {
  [ScopeTypeId]: ScopeTypeId,
  [CloseableScopeTypeId]: CloseableScopeTypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
  fork(strategy) {
    return sync(() => {
      const newScope = scopeUnsafeMake(strategy);
      if (this.state._tag === "Closed") {
        newScope.state = this.state;
        return newScope;
      }
      const fin = (exit2) => newScope.close(exit2);
      this.state.finalizers.add(fin);
      scopeUnsafeAddFinalizer(newScope, (_) => sync(() => {
        if (this.state._tag === "Open") {
          this.state.finalizers.delete(fin);
        }
      }));
      return newScope;
    });
  },
  close(exit2) {
    return suspend(() => {
      if (this.state._tag === "Closed") {
        return unit;
      }
      const finalizers = Array.from(this.state.finalizers.values()).reverse();
      this.state = {
        _tag: "Closed",
        exit: exit2
      };
      if (finalizers.length === 0) {
        return unit;
      }
      return isSequential(this.strategy) ? pipe(forEachSequential(finalizers, (fin) => exit(fin(exit2))), flatMap7((results) => pipe(exitCollectAll(results), map(exitAsUnit), getOrElse(() => exitUnit)))) : isParallel(this.strategy) ? pipe(forEachParUnbounded(finalizers, (fin) => exit(fin(exit2)), false), flatMap7((results) => pipe(exitCollectAll(results, {
        parallel: true
      }), map(exitAsUnit), getOrElse(() => exitUnit)))) : pipe(forEachParN(finalizers, this.strategy.parallelism, (fin) => exit(fin(exit2)), false), flatMap7((results) => pipe(exitCollectAll(results, {
        parallel: true
      }), map(exitAsUnit), getOrElse(() => exitUnit))));
    });
  },
  addFinalizer(fin) {
    return suspend(() => {
      if (this.state._tag === "Closed") {
        return fin(this.state.exit);
      }
      this.state.finalizers.add(fin);
      return unit;
    });
  }
};
var scopeUnsafeMake = (strategy = sequential2) => {
  const scope2 = Object.create(ScopeImplProto);
  scope2.strategy = strategy;
  scope2.state = {
    _tag: "Open",
    finalizers: new Set
  };
  return scope2;
};
var scopeMake = (strategy = sequential2) => sync(() => scopeUnsafeMake(strategy));
var scopeExtend = /* @__PURE__ */ dual(2, (effect, scope2) => mapInputContext(effect, merge2(make2(scopeTag, scope2))));
var scopeUse = /* @__PURE__ */ dual(2, (effect, scope2) => pipe(effect, scopeExtend(scope2), onExit((exit2) => scope2.close(exit2))));
var fiberRefUnsafeMakeSupervisor = (initial) => fiberRefUnsafeMakePatch(initial, {
  differ: differ2,
  fork: empty26
});
var currentRuntimeFlags = /* @__PURE__ */ fiberRefUnsafeMakeRuntimeFlags(none5);
var currentSupervisor = /* @__PURE__ */ fiberRefUnsafeMakeSupervisor(none7);
var raceWith = /* @__PURE__ */ dual(3, (self, other, options) => raceFibersWith(self, other, {
  onSelfWin: (winner, loser) => flatMap7(winner.await, (exit2) => {
    switch (exit2._tag) {
      case OP_SUCCESS: {
        return flatMap7(winner.inheritAll, () => options.onSelfDone(exit2, loser));
      }
      case OP_FAILURE: {
        return options.onSelfDone(exit2, loser);
      }
    }
  }),
  onOtherWin: (winner, loser) => flatMap7(winner.await, (exit2) => {
    switch (exit2._tag) {
      case OP_SUCCESS: {
        return flatMap7(winner.inheritAll, () => options.onOtherDone(exit2, loser));
      }
      case OP_FAILURE: {
        return options.onOtherDone(exit2, loser);
      }
    }
  })
}));
var race = /* @__PURE__ */ dual(2, (self, that) => fiberIdWith((parentFiberId) => raceWith(self, that, {
  onSelfDone: (exit2, right3) => exitMatchEffect(exit2, {
    onFailure: (cause) => pipe(join2(right3), mapErrorCause((cause2) => parallel(cause, cause2))),
    onSuccess: (value) => pipe(right3, interruptAsFiber(parentFiberId), as(value))
  }),
  onOtherDone: (exit2, left3) => exitMatchEffect(exit2, {
    onFailure: (cause) => pipe(join2(left3), mapErrorCause((cause2) => parallel(cause2, cause))),
    onSuccess: (value) => pipe(left3, interruptAsFiber(parentFiberId), as(value))
  })
})));
var raceFibersWith = /* @__PURE__ */ dual(3, (self, other, options) => withFiberRuntime((parentFiber, parentStatus) => {
  const parentRuntimeFlags = parentStatus.runtimeFlags;
  const raceIndicator = make9(true);
  const leftFiber = unsafeMakeChildFiber(self, parentFiber, parentRuntimeFlags, options.selfScope);
  const rightFiber = unsafeMakeChildFiber(other, parentFiber, parentRuntimeFlags, options.otherScope);
  return async((cb) => {
    leftFiber.addObserver(() => completeRace(leftFiber, rightFiber, options.onSelfWin, raceIndicator, cb));
    rightFiber.addObserver(() => completeRace(rightFiber, leftFiber, options.onOtherWin, raceIndicator, cb));
    leftFiber.startFork(self);
    rightFiber.startFork(other);
  }, combine3(leftFiber.id(), rightFiber.id()));
}));
var completeRace = (winner, loser, cont, ab, cb) => {
  if (compareAndSet(true, false)(ab)) {
    cb(cont(winner, loser));
  }
};
var ensuring = /* @__PURE__ */ dual(2, (self, finalizer) => uninterruptibleMask((restore) => matchCauseEffect(restore(self), {
  onFailure: (cause1) => matchCauseEffect(finalizer, {
    onFailure: (cause2) => failCause(sequential(cause1, cause2)),
    onSuccess: () => failCause(cause1)
  }),
  onSuccess: (a) => as(finalizer, a)
})));
var invokeWithInterrupt = (self, entries2, onInterrupt2) => fiberIdWith((id) => flatMap7(flatMap7(forkDaemon(interruptible2(self)), (processing) => async((cb) => {
  const counts = entries2.map((_) => _.listeners.count);
  const checkDone = () => {
    if (counts.every((count) => count === 0)) {
      cleanup.forEach((f) => f());
      onInterrupt2?.();
      cb(interruptFiber(processing));
    }
  };
  processing.addObserver((exit2) => {
    cleanup.forEach((f) => f());
    cb(exit2);
  });
  const cleanup = entries2.map((r, i) => {
    const observer = (count) => {
      counts[i] = count;
      checkDone();
    };
    r.listeners.addObserver(observer);
    return () => r.listeners.removeObserver(observer);
  });
  checkDone();
  return sync(() => {
    cleanup.forEach((f) => f());
  });
})), () => suspend(() => {
  const residual = entries2.flatMap((entry) => {
    if (!entry.state.completed) {
      return [entry];
    }
    return [];
  });
  return forEachSequentialDiscard(residual, (entry) => complete(entry.request, exitInterrupt(id)));
})));

// node_modules/effect/dist/esm/Cause.js
var fail4 = fail;
var die4 = die;
var interrupt4 = interrupt;
var isDieType2 = isDieType;
var isInterrupted2 = isInterrupted;
var isInterruptedOnly2 = isInterruptedOnly;
var failureOrCause2 = failureOrCause;
var flipCauseOption2 = flipCauseOption;
var map11 = map8;

// node_modules/effect/dist/esm/internal/schedule/interval.js
var IntervalSymbolKey = "effect/ScheduleInterval";
var IntervalTypeId = /* @__PURE__ */ Symbol.for(IntervalSymbolKey);
var empty28 = {
  [IntervalTypeId]: IntervalTypeId,
  startMillis: 0,
  endMillis: 0
};
var make34 = (startMillis, endMillis) => {
  if (startMillis > endMillis) {
    return empty28;
  }
  return {
    [IntervalTypeId]: IntervalTypeId,
    startMillis,
    endMillis
  };
};
var lessThan2 = /* @__PURE__ */ dual(2, (self, that) => min2(self, that) === self);
var min2 = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.endMillis <= that.startMillis)
    return self;
  if (that.endMillis <= self.startMillis)
    return that;
  if (self.startMillis < that.startMillis)
    return self;
  if (that.startMillis < self.startMillis)
    return that;
  if (self.endMillis <= that.endMillis)
    return self;
  return that;
});
var isEmpty6 = (self) => {
  return self.startMillis >= self.endMillis;
};
var intersect = /* @__PURE__ */ dual(2, (self, that) => {
  const start = Math.max(self.startMillis, that.startMillis);
  const end = Math.min(self.endMillis, that.endMillis);
  return make34(start, end);
});
var size8 = (self) => {
  return millis(self.endMillis - self.startMillis);
};
var after = (startMilliseconds) => {
  return make34(startMilliseconds, Number.POSITIVE_INFINITY);
};

// node_modules/effect/dist/esm/ScheduleInterval.js
var make35 = make34;
var empty29 = empty28;
var lessThan3 = lessThan2;
var isEmpty7 = isEmpty6;
var intersect2 = intersect;
var size9 = size8;
var after2 = after;

// node_modules/effect/dist/esm/internal/schedule/intervals.js
var IntervalsSymbolKey = "effect/ScheduleIntervals";
var IntervalsTypeId = /* @__PURE__ */ Symbol.for(IntervalsSymbolKey);
var make36 = (intervals) => {
  return {
    [IntervalsTypeId]: IntervalsTypeId,
    intervals
  };
};
var intersect3 = /* @__PURE__ */ dual(2, (self, that) => intersectLoop(self.intervals, that.intervals, empty4()));
var intersectLoop = (_left, _right, _acc) => {
  let left3 = _left;
  let right3 = _right;
  let acc = _acc;
  while (isNonEmpty(left3) && isNonEmpty(right3)) {
    const interval = pipe(headNonEmpty2(left3), intersect2(headNonEmpty2(right3)));
    const intervals = isEmpty7(interval) ? acc : pipe(acc, prepend2(interval));
    if (pipe(headNonEmpty2(left3), lessThan3(headNonEmpty2(right3)))) {
      left3 = tailNonEmpty2(left3);
    } else {
      right3 = tailNonEmpty2(right3);
    }
    acc = intervals;
  }
  return make36(reverse2(acc));
};
var start = (self) => {
  return pipe(self.intervals, head2, getOrElse(() => empty29)).startMillis;
};
var end = (self) => {
  return pipe(self.intervals, head2, getOrElse(() => empty29)).endMillis;
};
var lessThan4 = /* @__PURE__ */ dual(2, (self, that) => start(self) < start(that));
var isNonEmpty3 = (self) => {
  return isNonEmpty(self.intervals);
};

// node_modules/effect/dist/esm/ScheduleIntervals.js
var make37 = make36;
var intersect4 = intersect3;
var start2 = start;
var end2 = end;
var lessThan5 = lessThan4;
var isNonEmpty4 = isNonEmpty3;

// node_modules/effect/dist/esm/internal/schedule/decision.js
var OP_CONTINUE = "Continue";
var OP_DONE2 = "Done";
var _continue = (intervals) => {
  return {
    _tag: OP_CONTINUE,
    intervals
  };
};
var continueWith = (interval) => {
  return {
    _tag: OP_CONTINUE,
    intervals: make37(of2(interval))
  };
};
var done4 = {
  _tag: OP_DONE2
};
var isContinue = (self) => {
  return self._tag === OP_CONTINUE;
};
var isDone4 = (self) => {
  return self._tag === OP_DONE2;
};

// node_modules/effect/dist/esm/ScheduleDecision.js
var _continue2 = _continue;
var continueWith2 = continueWith;
var done5 = done4;
var isContinue2 = isContinue;
var isDone5 = isDone4;

// node_modules/effect/dist/esm/Scope.js
var addFinalizer2 = scopeAddFinalizer;
var close = scopeClose;
var extend2 = scopeExtend;
var fork2 = scopeFork;
var make38 = scopeMake;

// node_modules/effect/dist/esm/Cron.js
var TypeId12 = /* @__PURE__ */ Symbol.for("effect/Cron");
var CronProto = {
  [TypeId12]: TypeId12,
  [symbol2](that) {
    return isCron(that) && equals3(this, that);
  },
  [symbol]() {
    return pipe(array(fromIterable(this.minutes)), combine(array(fromIterable(this.hours))), combine(array(fromIterable(this.days))), combine(array(fromIterable(this.months))), combine(array(fromIterable(this.weekdays))), cached(this));
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "Cron",
      minutes: fromIterable(this.minutes),
      hours: fromIterable(this.hours),
      days: fromIterable(this.days),
      months: fromIterable(this.months),
      weekdays: fromIterable(this.weekdays)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isCron = (u) => hasProperty(u, TypeId12);
var ParseErrorTypeId = /* @__PURE__ */ Symbol.for("effect/Cron/errors/ParseError");
var ParseErrorProto = {
  _tag: "ParseError",
  [ParseErrorTypeId]: ParseErrorTypeId
};
var Equivalence2 = /* @__PURE__ */ make3((self, that) => restrictionsEquals(self.minutes, that.minutes) && restrictionsEquals(self.hours, that.hours) && restrictionsEquals(self.days, that.days) && restrictionsEquals(self.months, that.months) && restrictionsEquals(self.weekdays, that.weekdays));
var restrictionsArrayEquals = /* @__PURE__ */ array2(number2);
var restrictionsEquals = (self, that) => restrictionsArrayEquals(fromIterable(self), fromIterable(that));
var equals3 = /* @__PURE__ */ dual(2, (self, that) => Equivalence2(self, that));

// node_modules/effect/dist/esm/internal/schedule.js
var ScheduleSymbolKey = "effect/Schedule";
var ScheduleTypeId = /* @__PURE__ */ Symbol.for(ScheduleSymbolKey);
var isSchedule = (u) => hasProperty(u, ScheduleTypeId);
var ScheduleDriverSymbolKey = "effect/ScheduleDriver";
var ScheduleDriverTypeId = /* @__PURE__ */ Symbol.for(ScheduleDriverSymbolKey);
var scheduleVariance = {
  _Out: (_) => _,
  _In: (_) => _,
  _R: (_) => _
};
var scheduleDriverVariance = {
  _Out: (_) => _,
  _In: (_) => _,
  _R: (_) => _
};

class ScheduleImpl {
  initial;
  step;
  [ScheduleTypeId] = scheduleVariance;
  constructor(initial, step3) {
    this.initial = initial;
    this.step = step3;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}

class ScheduleDriverImpl {
  schedule;
  ref;
  [ScheduleDriverTypeId] = scheduleDriverVariance;
  constructor(schedule, ref) {
    this.schedule = schedule;
    this.ref = ref;
  }
  get state() {
    return map9(get9(this.ref), (tuple3) => tuple3[1]);
  }
  get last() {
    return flatMap7(get9(this.ref), ([element, _]) => {
      switch (element._tag) {
        case "None": {
          return failSync(() => new NoSuchElementException);
        }
        case "Some": {
          return succeed(element.value);
        }
      }
    });
  }
  get reset() {
    return set4(this.ref, [none2(), this.schedule.initial]);
  }
  next(input) {
    return pipe(map9(get9(this.ref), (tuple3) => tuple3[1]), flatMap7((state) => pipe(currentTimeMillis2, flatMap7((now) => pipe(suspend(() => this.schedule.step(now, input, state)), flatMap7(([state2, out, decision]) => {
      const setState = set4(this.ref, [some2(out), state2]);
      if (isDone5(decision)) {
        return zipRight(setState, fail2(none2()));
      }
      const millis2 = start2(decision.intervals) - now;
      if (millis2 <= 0) {
        return as(setState, out);
      }
      return pipe(setState, zipRight(sleep3(millis(millis2))), as(out));
    }))))));
  }
}
var makeWithState = (initial, step3) => new ScheduleImpl(initial, step3);
var addDelay = /* @__PURE__ */ dual(2, (self, f) => addDelayEffect(self, (out) => sync(() => f(out))));
var addDelayEffect = /* @__PURE__ */ dual(2, (self, f) => modifyDelayEffect(self, (out, duration) => map9(f(out), (delay) => sum(duration, decode(delay)))));
var check = /* @__PURE__ */ dual(2, (self, test) => checkEffect(self, (input, out) => sync(() => test(input, out))));
var checkEffect = /* @__PURE__ */ dual(2, (self, test) => makeWithState(self.initial, (now, input, state) => flatMap7(self.step(now, input, state), ([state2, out, decision]) => {
  if (isDone5(decision)) {
    return succeed([state2, out, done5]);
  }
  return map9(test(input, out), (cont) => cont ? [state2, out, decision] : [state2, out, done5]);
})));
var delayedSchedule = (schedule) => addDelay(schedule, (x) => x);
var driver = (self) => pipe(make24([none2(), self.initial]), map9((ref) => new ScheduleDriverImpl(self, ref)));
var exponential2 = (baseInput, factor = 2) => {
  const base = decode(baseInput);
  return delayedSchedule(map13(forever2, (i) => times(base, Math.pow(factor, i))));
};
var intersect5 = /* @__PURE__ */ dual(2, (self, that) => intersectWith(self, that, intersect4));
var intersectWith = /* @__PURE__ */ dual(3, (self, that, f) => makeWithState([self.initial, that.initial], (now, input, state) => pipe(zipWith2(self.step(now, input, state[0]), that.step(now, input, state[1]), (a, b) => [a, b]), flatMap7(([[lState, out, lDecision], [rState, out2, rDecision]]) => {
  if (isContinue2(lDecision) && isContinue2(rDecision)) {
    return intersectWithLoop(self, that, input, lState, out, lDecision.intervals, rState, out2, rDecision.intervals, f);
  }
  return succeed([[lState, rState], [out, out2], done5]);
}))));
var intersectWithLoop = (self, that, input, lState, out, lInterval, rState, out2, rInterval, f) => {
  const combined = f(lInterval, rInterval);
  if (isNonEmpty4(combined)) {
    return succeed([[lState, rState], [out, out2], _continue2(combined)]);
  }
  if (pipe(lInterval, lessThan5(rInterval))) {
    return flatMap7(self.step(end2(lInterval), input, lState), ([lState2, out3, decision]) => {
      if (isDone5(decision)) {
        return succeed([[lState2, rState], [out3, out2], done5]);
      }
      return intersectWithLoop(self, that, input, lState2, out3, decision.intervals, rState, out2, rInterval, f);
    });
  }
  return flatMap7(that.step(end2(rInterval), input, rState), ([rState2, out22, decision]) => {
    if (isDone5(decision)) {
      return succeed([[lState, rState2], [out, out22], done5]);
    }
    return intersectWithLoop(self, that, input, lState, out, lInterval, rState2, out22, decision.intervals, f);
  });
};
var map13 = /* @__PURE__ */ dual(2, (self, f) => mapEffect(self, (out) => sync(() => f(out))));
var mapEffect = /* @__PURE__ */ dual(2, (self, f) => makeWithState(self.initial, (now, input, state) => flatMap7(self.step(now, input, state), ([state2, out, decision]) => map9(f(out), (out2) => [state2, out2, decision]))));
var modifyDelayEffect = /* @__PURE__ */ dual(2, (self, f) => makeWithState(self.initial, (now, input, state) => flatMap7(self.step(now, input, state), ([state2, out, decision]) => {
  if (isDone5(decision)) {
    return succeed([state2, out, decision]);
  }
  const intervals = decision.intervals;
  const delay = size9(make35(now, start2(intervals)));
  return map9(f(out, delay), (durationInput) => {
    const duration = decode(durationInput);
    const oldStart = start2(intervals);
    const newStart = now + toMillis(duration);
    const delta = newStart - oldStart;
    const newEnd = Math.min(Math.max(0, end2(intervals) + delta), Number.MAX_SAFE_INTEGER);
    const newInterval = make35(newStart, newEnd);
    return [state2, out, continueWith2(newInterval)];
  });
})));
var passthrough = (self) => makeWithState(self.initial, (now, input, state) => pipe(self.step(now, input, state), map9(([state2, _, decision]) => [state2, input, decision])));
var recurs = (n) => whileOutput(forever2, (out) => out < n);
var unfold2 = (initial, f) => makeWithState(initial, (now, _, state) => sync(() => [f(state), state, continueWith2(after2(now))]));
var untilInputEffect = /* @__PURE__ */ dual(2, (self, f) => checkEffect(self, (input, _) => negate(f(input))));
var whileInputEffect = /* @__PURE__ */ dual(2, (self, f) => checkEffect(self, (input, _) => f(input)));
var whileOutput = /* @__PURE__ */ dual(2, (self, f) => check(self, (_, out) => f(out)));
var ScheduleDefectTypeId = /* @__PURE__ */ Symbol.for("effect/Schedule/ScheduleDefect");

class ScheduleDefect {
  error;
  [ScheduleDefectTypeId];
  constructor(error) {
    this.error = error;
    this[ScheduleDefectTypeId] = ScheduleDefectTypeId;
  }
}
var isScheduleDefect = (u) => hasProperty(u, ScheduleDefectTypeId);
var scheduleDefectWrap = (self) => catchAll(self, (e) => die2(new ScheduleDefect(e)));
var scheduleDefectRefail = (self) => catchAllCause(self, (cause) => match(find(cause, (_) => isDieType(_) && isScheduleDefect(_.defect) ? some2(_.defect) : none2()), {
  onNone: () => failCause(cause),
  onSome: (error) => fail2(error.error)
}));
var repeat_Effect = /* @__PURE__ */ dual(2, (self, schedule) => repeatOrElse_Effect(self, schedule, (e, _) => fail2(e)));
var repeat_combined = /* @__PURE__ */ dual(2, (self, options) => {
  if (isSchedule(options)) {
    return repeat_Effect(self, options);
  }
  const base = options.schedule ?? passthrough(forever2);
  const withWhile = options.while ? whileInputEffect(base, (a) => {
    const applied = options.while(a);
    if (typeof applied === "boolean") {
      return succeed(applied);
    }
    return scheduleDefectWrap(applied);
  }) : base;
  const withUntil = options.until ? untilInputEffect(withWhile, (a) => {
    const applied = options.until(a);
    if (typeof applied === "boolean") {
      return succeed(applied);
    }
    return scheduleDefectWrap(applied);
  }) : withWhile;
  const withTimes = options.times ? intersect5(withUntil, recurs(options.times)) : withUntil;
  return scheduleDefectRefail(repeat_Effect(self, withTimes));
});
var repeatOrElse_Effect = /* @__PURE__ */ dual(3, (self, schedule, orElse2) => flatMap7(driver(schedule), (driver2) => matchEffect(self, {
  onFailure: (error) => orElse2(error, none2()),
  onSuccess: (value) => repeatOrElseEffectLoop(self, driver2, orElse2, value)
})));
var repeatOrElseEffectLoop = (self, driver2, orElse2, value) => {
  return matchEffect(driver2.next(value), {
    onFailure: () => orDie(driver2.last),
    onSuccess: (b) => matchEffect(self, {
      onFailure: (error) => orElse2(error, some2(b)),
      onSuccess: (value2) => repeatOrElseEffectLoop(self, driver2, orElse2, value2)
    })
  });
};
var retry_Effect = /* @__PURE__ */ dual(2, (self, policy) => retryOrElse_Effect(self, policy, (e, _) => fail2(e)));
var retry_combined = /* @__PURE__ */ dual(2, (self, options) => {
  if (isSchedule(options)) {
    return retry_Effect(self, options);
  }
  const base = options.schedule ?? forever2;
  const withWhile = options.while ? whileInputEffect(base, (e) => {
    const applied = options.while(e);
    if (typeof applied === "boolean") {
      return succeed(applied);
    }
    return scheduleDefectWrap(applied);
  }) : base;
  const withUntil = options.until ? untilInputEffect(withWhile, (e) => {
    const applied = options.until(e);
    if (typeof applied === "boolean") {
      return succeed(applied);
    }
    return scheduleDefectWrap(applied);
  }) : withWhile;
  const withTimes = options.times ? intersect5(withUntil, recurs(options.times)) : withUntil;
  return scheduleDefectRefail(retry_Effect(self, withTimes));
});
var retryOrElse_Effect = /* @__PURE__ */ dual(3, (self, policy, orElse2) => flatMap7(driver(policy), (driver2) => retryOrElse_EffectLoop(self, driver2, orElse2)));
var retryOrElse_EffectLoop = (self, driver2, orElse2) => {
  return catchAll(self, (e) => matchEffect(driver2.next(e), {
    onFailure: () => pipe(driver2.last, orDie, flatMap7((out) => orElse2(e, out))),
    onSuccess: () => retryOrElse_EffectLoop(self, driver2, orElse2)
  }));
};
var forever2 = /* @__PURE__ */ unfold2(0, (n) => n + 1);

// node_modules/effect/dist/esm/internal/effect/circular.js
class Semaphore {
  permits;
  waiters = new Set;
  taken = 0;
  constructor(permits) {
    this.permits = permits;
  }
  get free() {
    return this.permits - this.taken;
  }
  take = (n) => async((resume2) => {
    if (this.free < n) {
      const observer = () => {
        if (this.free < n) {
          return;
        }
        this.waiters.delete(observer);
        this.taken += n;
        resume2(succeed(n));
      };
      this.waiters.add(observer);
      return sync(() => {
        this.waiters.delete(observer);
      });
    }
    this.taken += n;
    return resume2(succeed(n));
  });
  updateTaken = (f) => withFiberRuntime((fiber) => {
    this.taken = f(this.taken);
    if (this.waiters.size > 0) {
      fiber.getFiberRef(currentScheduler).scheduleTask(() => {
        const iter = this.waiters.values();
        let item = iter.next();
        while (item.done === false && this.free > 0) {
          item.value();
          item = iter.next();
        }
      }, fiber.getFiberRef(currentSchedulingPriority));
    }
    return succeed(this.free);
  });
  release = (n) => this.updateTaken((taken) => taken - n);
  releaseAll = this.updateTaken((_) => 0);
  withPermits = (n) => (self) => uninterruptibleMask((restore) => flatMap7(restore(this.take(n)), (permits) => ensuring(restore(self), this.release(permits))));
}
var unsafeMakeSemaphore = (permits) => new Semaphore(permits);
var makeSemaphore = (permits) => sync(() => unsafeMakeSemaphore(permits));
var forkIn = /* @__PURE__ */ dual(2, (self, scope2) => uninterruptibleMask((restore) => flatMap7(scope2.fork(sequential2), (child) => pipe(restore(self), onExit((exit2) => child.close(exit2)), forkDaemon, tap((fiber) => child.addFinalizer(() => fiberIdWith((fiberId2) => equals(fiberId2, fiber.id()) ? unit : asUnit(interruptFiber(fiber)))))))));
var forkScoped = (self) => scopeWith((scope2) => forkIn(self, scope2));
var raceFirst = /* @__PURE__ */ dual(2, (self, that) => pipe(exit(self), race(exit(that)), (effect) => flatten3(effect)));
var SynchronizedSymbolKey = "effect/Ref/SynchronizedRef";
var SynchronizedTypeId = /* @__PURE__ */ Symbol.for(SynchronizedSymbolKey);
var synchronizedVariance = {
  _A: (_) => _
};

class SynchronizedImpl {
  ref;
  withLock;
  [SynchronizedTypeId] = synchronizedVariance;
  [RefTypeId] = refVariance;
  [TypeId9];
  constructor(ref, withLock) {
    this.ref = ref;
    this.withLock = withLock;
    this[TypeId9] = TypeId9;
    this.get = get9(this.ref);
  }
  get;
  modify(f) {
    return this.modifyEffect((a) => succeed(f(a)));
  }
  modifyEffect(f) {
    return this.withLock(pipe(flatMap7(get9(this.ref), f), flatMap7(([b, a]) => as(set4(this.ref, a), b))));
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var makeSynchronized = (value) => sync(() => unsafeMakeSynchronized(value));
var unsafeMakeSynchronized = (value) => {
  const ref = unsafeMake4(value);
  const sem = unsafeMakeSemaphore(1);
  return new SynchronizedImpl(ref, sem.withPermits(1));
};

// node_modules/effect/dist/esm/internal/opCodes/layer.js
var OP_FRESH = "Fresh";
var OP_FROM_EFFECT = "FromEffect";
var OP_SUSPEND = "Suspend";
var OP_ZIP_WITH2 = "ZipWith";

// node_modules/effect/dist/esm/Fiber.js
var _await3 = _await2;
var inheritAll2 = inheritAll;
var interrupt5 = interruptFiber;
var join3 = join2;

// node_modules/effect/dist/esm/internal/runtime.js
var unsafeFork2 = (runtime2) => (self, options) => {
  const fiberId2 = unsafeMake2();
  const fiberRefUpdates = [[currentContext, [[fiberId2, runtime2.context]]]];
  if (options?.scheduler) {
    fiberRefUpdates.push([currentScheduler, [[fiberId2, options.scheduler]]]);
  }
  let fiberRefs3 = updateManyAs2(runtime2.fiberRefs, {
    entries: fiberRefUpdates,
    forkAs: fiberId2
  });
  if (options?.updateRefs) {
    fiberRefs3 = options.updateRefs(fiberRefs3, fiberId2);
  }
  const fiberRuntime = new FiberRuntime(fiberId2, fiberRefs3, runtime2.runtimeFlags);
  let effect = self;
  if (options?.scope) {
    effect = flatMap7(fork2(options.scope, sequential2), (closeableScope) => zipRight(scopeAddFinalizer(closeableScope, fiberIdWith((id2) => equals(id2, fiberRuntime.id()) ? unit : interruptAsFiber(fiberRuntime, id2))), onExit(self, (exit2) => close(closeableScope, exit2))));
  }
  const supervisor = fiberRuntime._supervisor;
  if (supervisor !== none7) {
    supervisor.onStart(runtime2.context, effect, none2(), fiberRuntime);
    fiberRuntime.addObserver((exit2) => supervisor.onEnd(exit2, fiberRuntime));
  }
  globalScope.add(runtime2.runtimeFlags, fiberRuntime);
  if (options?.immediate === false) {
    fiberRuntime.resume(effect);
  } else {
    fiberRuntime.start(effect);
  }
  return fiberRuntime;
};
var FiberFailureId = /* @__PURE__ */ Symbol.for("effect/Runtime/FiberFailure");
var FiberFailureCauseId = /* @__PURE__ */ Symbol.for("effect/Runtime/FiberFailure/Cause");

class FiberFailureImpl extends Error {
  [FiberFailureId];
  [FiberFailureCauseId];
  constructor(cause) {
    super();
    this[FiberFailureId] = FiberFailureId;
    this[FiberFailureCauseId] = cause;
    const prettyErrors2 = prettyErrors(cause);
    if (prettyErrors2.length > 0) {
      const head3 = prettyErrors2[0];
      this.name = head3.message.split(":")[0];
      this.message = head3.message.substring(this.name.length + 2);
      this.stack = pretty(cause);
    }
    this.name = `(FiberFailure) ${this.name}`;
  }
  toJSON() {
    return {
      _id: "FiberFailure",
      cause: this[FiberFailureCauseId].toJSON()
    };
  }
  toString() {
    return "(FiberFailure) " + pretty(this[FiberFailureCauseId]);
  }
  [NodeInspectSymbol]() {
    return this.toString();
  }
}
var fiberFailure = (cause) => {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 0;
  const error = new FiberFailureImpl(cause);
  Error.stackTraceLimit = limit;
  return error;
};
var fastPath = (effect) => {
  const op = effect;
  switch (op._op) {
    case "Failure":
    case "Success": {
      return op;
    }
    case "Left": {
      return exitFail(op.left);
    }
    case "Right": {
      return exitSucceed(op.right);
    }
    case "Some": {
      return exitSucceed(op.value);
    }
    case "None": {
      return exitFail(NoSuchElementException());
    }
  }
};
var unsafeRunPromise = (runtime2) => (effect, options) => unsafeRunPromiseExit(runtime2)(effect, options).then((result) => {
  switch (result._tag) {
    case OP_SUCCESS: {
      return result.effect_instruction_i0;
    }
    case OP_FAILURE: {
      throw fiberFailure(result.effect_instruction_i0);
    }
  }
});
var unsafeRunPromiseExit = (runtime2) => (effect, options) => new Promise((resolve) => {
  const op = fastPath(effect);
  if (op) {
    resolve(op);
  }
  const fiber = unsafeFork2(runtime2)(effect);
  fiber.addObserver((exit2) => {
    resolve(exit2);
  });
  if (options?.signal !== undefined) {
    if (options.signal.aborted) {
      fiber.unsafeInterruptAsFork(fiber.id());
    } else {
      options.signal.addEventListener("abort", () => {
        fiber.unsafeInterruptAsFork(fiber.id());
      });
    }
  }
});

class RuntimeImpl {
  context;
  runtimeFlags;
  fiberRefs;
  constructor(context2, runtimeFlags2, fiberRefs3) {
    this.context = context2;
    this.runtimeFlags = runtimeFlags2;
    this.fiberRefs = fiberRefs3;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var make39 = (options) => new RuntimeImpl(options.context, options.runtimeFlags, options.fiberRefs);
var defaultRuntimeFlags = /* @__PURE__ */ make14(Interruption, CooperativeYielding, RuntimeMetrics);
var defaultRuntime = /* @__PURE__ */ make39({
  context: /* @__PURE__ */ empty2(),
  runtimeFlags: defaultRuntimeFlags,
  fiberRefs: /* @__PURE__ */ empty21()
});
var unsafeRunPromiseEffect = /* @__PURE__ */ unsafeRunPromise(defaultRuntime);

// node_modules/effect/dist/esm/internal/synchronizedRef.js
var modifyEffect = /* @__PURE__ */ dual(2, (self, f) => self.modifyEffect(f));

// node_modules/effect/dist/esm/internal/layer.js
var LayerSymbolKey = "effect/Layer";
var LayerTypeId = /* @__PURE__ */ Symbol.for(LayerSymbolKey);
var layerVariance = {
  _RIn: (_) => _,
  _E: (_) => _,
  _ROut: (_) => _
};
var proto3 = {
  [LayerTypeId]: layerVariance,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var MemoMapTypeIdKey = "effect/Layer/MemoMap";
var MemoMapTypeId = /* @__PURE__ */ Symbol.for(MemoMapTypeIdKey);
var isLayer = (u) => hasProperty(u, LayerTypeId);
var isFresh = (self) => {
  return self._tag === OP_FRESH;
};

class MemoMapImpl {
  ref;
  [MemoMapTypeId];
  constructor(ref) {
    this.ref = ref;
    this[MemoMapTypeId] = MemoMapTypeId;
  }
  getOrElseMemoize(layer, scope2) {
    return pipe(modifyEffect(this.ref, (map15) => {
      const inMap = map15.get(layer);
      if (inMap !== undefined) {
        const [acquire, release] = inMap;
        const cached2 = pipe(acquire, flatMap7(([patch12, b]) => pipe(patchFiberRefs(patch12), as(b))), onExit(exitMatch({
          onFailure: () => unit,
          onSuccess: () => scopeAddFinalizerExit(scope2, release)
        })));
        return succeed([cached2, map15]);
      }
      return pipe(make24(0), flatMap7((observers) => pipe(deferredMake(), flatMap7((deferred) => pipe(make24(() => unit), map9((finalizerRef) => {
        const resource = uninterruptibleMask((restore) => pipe(scopeMake(), flatMap7((innerScope) => pipe(restore(flatMap7(makeBuilder(layer, innerScope, true), (f) => diffFiberRefs(f(this)))), exit, flatMap7((exit2) => {
          switch (exit2._tag) {
            case OP_FAILURE: {
              return pipe(deferredFailCause(deferred, exit2.effect_instruction_i0), zipRight(scopeClose(innerScope, exit2)), zipRight(failCause(exit2.effect_instruction_i0)));
            }
            case OP_SUCCESS: {
              return pipe(set4(finalizerRef, (exit3) => pipe(scopeClose(innerScope, exit3), whenEffect(modify2(observers, (n) => [n === 1, n - 1])), asUnit)), zipRight(update2(observers, (n) => n + 1)), zipRight(scopeAddFinalizerExit(scope2, (exit3) => pipe(sync(() => map15.delete(layer)), zipRight(get9(finalizerRef)), flatMap7((finalizer) => finalizer(exit3))))), zipRight(deferredSucceed(deferred, exit2.effect_instruction_i0)), as(exit2.effect_instruction_i0[1]));
            }
          }
        })))));
        const memoized = [pipe(deferredAwait(deferred), onExit(exitMatchEffect({
          onFailure: () => unit,
          onSuccess: () => update2(observers, (n) => n + 1)
        }))), (exit2) => pipe(get9(finalizerRef), flatMap7((finalizer) => finalizer(exit2)))];
        return [resource, isFresh(layer) ? map15 : map15.set(layer, memoized)];
      }))))));
    }), flatten3);
  }
}
var makeMemoMap = /* @__PURE__ */ suspend(() => map9(makeSynchronized(new Map), (ref) => new MemoMapImpl(ref)));
var buildWithScope = /* @__PURE__ */ dual(2, (self, scope2) => flatMap7(makeMemoMap, (memoMap) => flatMap7(makeBuilder(self, scope2), (run) => run(memoMap))));
var makeBuilder = (self, scope2, inMemoMap = false) => {
  const op = self;
  switch (op._tag) {
    case "Locally": {
      return sync(() => (memoMap) => op.f(memoMap.getOrElseMemoize(op.self, scope2)));
    }
    case "ExtendScope": {
      return sync(() => (memoMap) => scopeWith((scope3) => memoMap.getOrElseMemoize(op.layer, scope3)));
    }
    case "Fold": {
      return sync(() => (memoMap) => pipe(memoMap.getOrElseMemoize(op.layer, scope2), matchCauseEffect({
        onFailure: (cause) => memoMap.getOrElseMemoize(op.failureK(cause), scope2),
        onSuccess: (value) => memoMap.getOrElseMemoize(op.successK(value), scope2)
      })));
    }
    case "Fresh": {
      return sync(() => (_) => pipe(op.layer, buildWithScope(scope2)));
    }
    case "FromEffect": {
      return inMemoMap ? sync(() => (_) => op.effect) : sync(() => (memoMap) => memoMap.getOrElseMemoize(self, scope2));
    }
    case "Provide": {
      return sync(() => (memoMap) => pipe(memoMap.getOrElseMemoize(op.first, scope2), flatMap7((env) => pipe(memoMap.getOrElseMemoize(op.second, scope2), provideContext(env)))));
    }
    case "Scoped": {
      return inMemoMap ? sync(() => (_) => scopeExtend(op.effect, scope2)) : sync(() => (memoMap) => memoMap.getOrElseMemoize(self, scope2));
    }
    case "Suspend": {
      return sync(() => (memoMap) => memoMap.getOrElseMemoize(op.evaluate(), scope2));
    }
    case "ProvideMerge": {
      return sync(() => (memoMap) => pipe(memoMap.getOrElseMemoize(op.first, scope2), zipWith2(memoMap.getOrElseMemoize(op.second, scope2), op.zipK)));
    }
    case "ZipWith": {
      return sync(() => (memoMap) => pipe(memoMap.getOrElseMemoize(op.first, scope2), zipWithOptions(memoMap.getOrElseMemoize(op.second, scope2), op.zipK, {
        concurrent: true
      })));
    }
  }
};
var fromEffect3 = /* @__PURE__ */ dual(2, (a, b) => {
  const tagFirst = isTag2(a);
  const tag = tagFirst ? a : b;
  const effect = tagFirst ? b : a;
  return fromEffectContext(map9(effect, (service) => make2(tag, service)));
});
function fromEffectContext(effect) {
  const fromEffect4 = Object.create(proto3);
  fromEffect4._tag = OP_FROM_EFFECT;
  fromEffect4.effect = effect;
  return fromEffect4;
}
var merge5 = /* @__PURE__ */ dual(2, (self, that) => zipWith4(self, that, (a, b) => merge2(a, b)));
var mergeAll = (...layers) => {
  let final = layers[0];
  for (let i = 1;i < layers.length; i++) {
    final = merge5(final, layers[i]);
  }
  return final;
};
var succeed5 = /* @__PURE__ */ dual(2, (a, b) => {
  const tagFirst = isTag2(a);
  const tag = tagFirst ? a : b;
  const resource = tagFirst ? b : a;
  return fromEffectContext(succeed(make2(tag, resource)));
});
var suspend2 = (evaluate) => {
  const suspend3 = Object.create(proto3);
  suspend3._tag = OP_SUSPEND;
  suspend3.evaluate = evaluate;
  return suspend3;
};
var zipWith4 = /* @__PURE__ */ dual(3, (self, that, f) => suspend2(() => {
  const zipWith5 = Object.create(proto3);
  zipWith5._tag = OP_ZIP_WITH2;
  zipWith5.first = self;
  zipWith5.second = that;
  zipWith5.zipK = f;
  return zipWith5;
}));
var provideSomeLayer = /* @__PURE__ */ dual(2, (self, layer) => acquireUseRelease(scopeMake(), (scope2) => flatMap7(buildWithScope(layer, scope2), (context2) => provideSomeContext(self, context2)), (scope2, exit2) => scopeClose(scope2, exit2)));
var provideSomeRuntime = /* @__PURE__ */ dual(2, (self, rt) => {
  const patchRefs = diff9(defaultRuntime.fiberRefs, rt.fiberRefs);
  const patchFlags = diff7(defaultRuntime.runtimeFlags, rt.runtimeFlags);
  return uninterruptibleMask((restore) => withFiberRuntime((fiber) => {
    const oldRefs = fiber.getFiberRefs();
    const newRefs = patch10(fiber.id(), oldRefs)(patchRefs);
    const oldFlags = fiber._runtimeFlags;
    const newFlags = patch7(patchFlags)(oldFlags);
    const rollbackRefs = diff9(newRefs, oldRefs);
    const rollbackFlags = diff7(newFlags, oldFlags);
    fiber.setFiberRefs(newRefs);
    fiber._runtimeFlags = newFlags;
    return ensuring(provideSomeContext(restore(self), rt.context), withFiberRuntime((fiber2) => {
      fiber2.setFiberRefs(patch10(fiber2.id(), fiber2.getFiberRefs())(rollbackRefs));
      fiber2._runtimeFlags = patch7(rollbackFlags)(fiber2._runtimeFlags);
      return unit;
    }));
  }));
});
var effect_provide = /* @__PURE__ */ dual(2, (self, source) => isLayer(source) ? provideSomeLayer(self, source) : isContext2(source) ? provideSomeContext(self, source) : provideSomeRuntime(self, source));

// node_modules/effect/dist/esm/MutableList.js
var TypeId13 = /* @__PURE__ */ Symbol.for("effect/MutableList");
var MutableListProto = {
  [TypeId13]: TypeId13,
  [Symbol.iterator]() {
    let done7 = false;
    let head3 = this.head;
    return {
      next() {
        if (done7) {
          return this.return();
        }
        if (head3 == null) {
          done7 = true;
          return this.return();
        }
        const value = head3.value;
        head3 = head3.next;
        return {
          done: done7,
          value
        };
      },
      return(value) {
        if (!done7) {
          done7 = true;
        }
        return {
          done: true,
          value
        };
      }
    };
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "MutableList",
      values: Array.from(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeNode = (value) => ({
  value,
  removed: false,
  prev: undefined,
  next: undefined
});
var empty31 = () => {
  const list = Object.create(MutableListProto);
  list.head = undefined;
  list.tail = undefined;
  list._length = 0;
  return list;
};
var isEmpty8 = (self) => length(self) === 0;
var length = (self) => self._length;
var append3 = /* @__PURE__ */ dual(2, (self, value) => {
  const node = makeNode(value);
  if (self.head === undefined) {
    self.head = node;
  }
  if (self.tail === undefined) {
    self.tail = node;
  } else {
    self.tail.next = node;
    node.prev = self.tail;
    self.tail = node;
  }
  self._length += 1;
  return self;
});
var shift = (self) => {
  const head3 = self.head;
  if (head3 !== undefined) {
    remove7(self, head3);
    return head3.value;
  }
  return;
};
var remove7 = (self, node) => {
  if (node.removed) {
    return;
  }
  node.removed = true;
  if (node.prev !== undefined && node.next !== undefined) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  } else if (node.prev !== undefined) {
    self.tail = node.prev;
    node.prev.next = undefined;
  } else if (node.next !== undefined) {
    self.head = node.next;
    node.next.prev = undefined;
  } else {
    self.tail = undefined;
    self.head = undefined;
  }
  if (self._length > 0) {
    self._length -= 1;
  }
};

// node_modules/effect/dist/esm/MutableQueue.js
var TypeId14 = /* @__PURE__ */ Symbol.for("effect/MutableQueue");
var EmptyMutableQueue = /* @__PURE__ */ Symbol.for("effect/mutable/MutableQueue/Empty");
var MutableQueueProto = {
  [TypeId14]: TypeId14,
  [Symbol.iterator]() {
    return Array.from(this.queue)[Symbol.iterator]();
  },
  toString() {
    return format(this.toJSON());
  },
  toJSON() {
    return {
      _id: "MutableQueue",
      values: Array.from(this).map(toJSON)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var make40 = (capacity) => {
  const queue = Object.create(MutableQueueProto);
  queue.queue = empty31();
  queue.capacity = capacity;
  return queue;
};
var bounded = (capacity) => make40(capacity);
var unbounded = () => make40(undefined);
var length2 = (self) => length(self.queue);
var isEmpty9 = (self) => isEmpty8(self.queue);
var capacity = (self) => self.capacity === undefined ? Infinity : self.capacity;
var offer = /* @__PURE__ */ dual(2, (self, value) => {
  const queueLength = length(self.queue);
  if (self.capacity !== undefined && queueLength === self.capacity) {
    return false;
  }
  append3(value)(self.queue);
  return true;
});
var offerAll = /* @__PURE__ */ dual(2, (self, values3) => {
  const iterator = values3[Symbol.iterator]();
  let next4;
  let remainder = empty4();
  let offering = true;
  while (offering && (next4 = iterator.next()) && !next4.done) {
    offering = offer(next4.value)(self);
  }
  while (next4 != null && !next4.done) {
    remainder = prepend2(next4.value)(remainder);
    next4 = iterator.next();
  }
  return reverse2(remainder);
});
var poll2 = /* @__PURE__ */ dual(2, (self, def) => {
  if (isEmpty8(self.queue)) {
    return def;
  }
  return shift(self.queue);
});
var pollUpTo = /* @__PURE__ */ dual(2, (self, n) => {
  let result = empty4();
  let count = 0;
  while (count < n) {
    const element = poll2(EmptyMutableQueue)(self);
    if (element === EmptyMutableQueue) {
      break;
    }
    result = prepend2(element)(result);
    count += 1;
  }
  return reverse2(result);
});

// node_modules/effect/dist/esm/Effect.js
var isEffect2 = isEffect;
var all5 = all3;
var forEach7 = forEach6;
var fail7 = fail2;
var failCause6 = failCause;
var dieMessage2 = dieMessage;
var gen2 = gen;
var succeed7 = succeed;
var suspend3 = suspend;
var sync2 = sync;
var unit4 = unit;
var catchAll2 = catchAll;
var catchAllCause2 = catchAllCause;
var catchSomeCause2 = catchSomeCause;
var ignore2 = ignore;
var retry = retry_combined;
var tryPromise2 = tryPromise;
var interrupt7 = interrupt2;
var interruptible3 = interruptible2;
var uninterruptible2 = uninterruptible;
var uninterruptibleMask2 = uninterruptibleMask;
var as3 = as;
var asUnit2 = asUnit;
var map15 = map9;
var mapError2 = mapError;
var acquireRelease2 = acquireRelease;
var acquireUseRelease2 = acquireUseRelease;
var addFinalizer3 = addFinalizer;
var ensuring2 = ensuring;
var scope2 = scope;
var scoped = scopedEffect;
var fiberIdWith2 = fiberIdWith;
var fork3 = fork;
var forkDaemon2 = forkDaemon;
var forkScoped2 = forkScoped;
var provide = effect_provide;
var either3 = either2;
var exit2 = exit;
var intoDeferred2 = intoDeferred;
var when2 = when;
var flatMap8 = flatMap7;
var flatten6 = flatten3;
var race2 = race;
var raceFirst2 = raceFirst;
var raceWith2 = raceWith;
var tap2 = tap;
var tapError2 = tapError;
var tapErrorCause2 = tapErrorCause;
var forever3 = forever;
var repeat = repeat_combined;
var match12 = match8;
var matchCause2 = matchCause;
var matchCauseEffect2 = matchCauseEffect;
var logWarning2 = logWarning;
var makeSemaphore2 = makeSemaphore;
var runPromise = unsafeRunPromiseEffect;
var zip5 = zipOptions;
var zipLeft2 = zipLeftOptions;
var zipRight3 = zipRightOptions;
var zipWith5 = zipWithOptions;

// node_modules/effect/dist/esm/Data.js
var struct2 = struct;
var Error3 = /* @__PURE__ */ function() {
  return class Base2 extends YieldableError {
    constructor(args) {
      super();
      if (args) {
        Object.assign(this, args);
      }
    }
  };
}();
var TaggedError = (tag) => {

  class Base2 extends Error3 {
    _tag = tag;
  }
  Base2.prototype.name = tag;
  return Base2;
};

// node_modules/effect/dist/esm/Layer.js
var effect = fromEffect3;
var mergeAll3 = mergeAll;
var succeed8 = succeed5;

// node_modules/effect/dist/esm/Schedule.js
var exponential3 = exponential2;

// packages/framework/src/effect/core/command-effects.ts
var CommandContext = GenericTag("CommandContext");

class CommandValidationError extends TaggedError("CommandValidationError") {
}

class CommandExecutionError extends TaggedError("CommandExecutionError") {
}

class AggregateNotFoundError extends TaggedError("AggregateNotFoundError") {
}

class ConcurrencyError extends TaggedError("ConcurrencyError") {
}
function createCommandHandler(config2) {
  return {
    canHandle: config2.canHandle,
    handle: (command) => pipe(config2.validate ? config2.validate(command) : succeed7(undefined), flatMap8(() => config2.execute(command)), tap2((result) => config2.onSuccess ? config2.onSuccess(result, command) : succeed7(undefined)), tapError2((error) => config2.onError ? config2.onError(error, command) : succeed7(undefined)))
  };
}
var CommandHandlerServiceLive = succeed8(CommandContext, CommandContext.of({
  eventStore: {},
  commandBus: {}
}));
// node_modules/effect/dist/esm/internal/queue.js
var EnqueueSymbolKey = "effect/QueueEnqueue";
var EnqueueTypeId = /* @__PURE__ */ Symbol.for(EnqueueSymbolKey);
var DequeueSymbolKey = "effect/QueueDequeue";
var DequeueTypeId = /* @__PURE__ */ Symbol.for(DequeueSymbolKey);
var QueueStrategySymbolKey = "effect/QueueStrategy";
var QueueStrategyTypeId = /* @__PURE__ */ Symbol.for(QueueStrategySymbolKey);
var BackingQueueSymbolKey = "effect/BackingQueue";
var BackingQueueTypeId = /* @__PURE__ */ Symbol.for(BackingQueueSymbolKey);
var queueStrategyVariance = {
  _A: (_) => _
};
var backingQueueVariance = {
  _A: (_) => _
};
var enqueueVariance = {
  _In: (_) => _
};
var dequeueVariance = {
  _Out: (_) => _
};

class QueueImpl {
  queue;
  takers;
  shutdownHook;
  shutdownFlag;
  strategy;
  [EnqueueTypeId] = enqueueVariance;
  [DequeueTypeId] = dequeueVariance;
  constructor(queue, takers, shutdownHook, shutdownFlag, strategy) {
    this.queue = queue;
    this.takers = takers;
    this.shutdownHook = shutdownHook;
    this.shutdownFlag = shutdownFlag;
    this.strategy = strategy;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  capacity() {
    return this.queue.capacity();
  }
  get size() {
    return suspend(() => catchAll(this.unsafeSize(), () => interrupt2));
  }
  unsafeSize() {
    if (get6(this.shutdownFlag)) {
      return none2();
    }
    return some2(this.queue.length() - length2(this.takers) + this.strategy.surplusSize());
  }
  get isEmpty() {
    return map9(this.size, (size11) => size11 <= 0);
  }
  get isFull() {
    return map9(this.size, (size11) => size11 >= this.capacity());
  }
  get shutdown() {
    return uninterruptible(withFiberRuntime((state) => {
      pipe(this.shutdownFlag, set2(true));
      return pipe(forEachConcurrentDiscard(unsafePollAll(this.takers), (d) => deferredInterruptWith(d, state.id()), false, false), zipRight(this.strategy.shutdown), whenEffect(deferredSucceed(this.shutdownHook, undefined)), asUnit);
    }));
  }
  get isShutdown() {
    return sync(() => get6(this.shutdownFlag));
  }
  get awaitShutdown() {
    return deferredAwait(this.shutdownHook);
  }
  isActive() {
    return !get6(this.shutdownFlag);
  }
  unsafeOffer(value) {
    if (get6(this.shutdownFlag)) {
      return false;
    }
    let noRemaining;
    if (this.queue.length() === 0) {
      const taker = pipe(this.takers, poll2(EmptyMutableQueue));
      if (taker !== EmptyMutableQueue) {
        unsafeCompleteDeferred(taker, value);
        noRemaining = true;
      } else {
        noRemaining = false;
      }
    } else {
      noRemaining = false;
    }
    if (noRemaining) {
      return true;
    }
    const succeeded = this.queue.offer(value);
    unsafeCompleteTakers(this.strategy, this.queue, this.takers);
    return succeeded;
  }
  offer(value) {
    return suspend(() => {
      if (get6(this.shutdownFlag)) {
        return interrupt2;
      }
      let noRemaining;
      if (this.queue.length() === 0) {
        const taker = pipe(this.takers, poll2(EmptyMutableQueue));
        if (taker !== EmptyMutableQueue) {
          unsafeCompleteDeferred(taker, value);
          noRemaining = true;
        } else {
          noRemaining = false;
        }
      } else {
        noRemaining = false;
      }
      if (noRemaining) {
        return succeed(true);
      }
      const succeeded = this.queue.offer(value);
      unsafeCompleteTakers(this.strategy, this.queue, this.takers);
      return succeeded ? succeed(true) : this.strategy.handleSurplus([value], this.queue, this.takers, this.shutdownFlag);
    });
  }
  offerAll(iterable) {
    return suspend(() => {
      if (get6(this.shutdownFlag)) {
        return interrupt2;
      }
      const values3 = fromIterable(iterable);
      const pTakers = this.queue.length() === 0 ? fromIterable(unsafePollN(this.takers, values3.length)) : empty3;
      const [forTakers, remaining] = pipe(values3, splitAt(pTakers.length));
      for (let i = 0;i < pTakers.length; i++) {
        const taker = pTakers[i];
        const item = forTakers[i];
        unsafeCompleteDeferred(taker, item);
      }
      if (remaining.length === 0) {
        return succeed(true);
      }
      const surplus = this.queue.offerAll(remaining);
      unsafeCompleteTakers(this.strategy, this.queue, this.takers);
      return isEmpty(surplus) ? succeed(true) : this.strategy.handleSurplus(surplus, this.queue, this.takers, this.shutdownFlag);
    });
  }
  get take() {
    return withFiberRuntime((state) => {
      if (get6(this.shutdownFlag)) {
        return interrupt2;
      }
      const item = this.queue.poll(EmptyMutableQueue);
      if (item !== EmptyMutableQueue) {
        this.strategy.unsafeOnQueueEmptySpace(this.queue, this.takers);
        return succeed(item);
      } else {
        const deferred = deferredUnsafeMake(state.id());
        return pipe(suspend(() => {
          pipe(this.takers, offer(deferred));
          unsafeCompleteTakers(this.strategy, this.queue, this.takers);
          return get6(this.shutdownFlag) ? interrupt2 : deferredAwait(deferred);
        }), onInterrupt(() => {
          return sync(() => unsafeRemove(this.takers, deferred));
        }));
      }
    });
  }
  get takeAll() {
    return suspend(() => {
      return get6(this.shutdownFlag) ? interrupt2 : sync(() => {
        const values3 = this.queue.pollUpTo(Number.POSITIVE_INFINITY);
        this.strategy.unsafeOnQueueEmptySpace(this.queue, this.takers);
        return fromIterable2(values3);
      });
    });
  }
  takeUpTo(max5) {
    return suspend(() => get6(this.shutdownFlag) ? interrupt2 : sync(() => {
      const values3 = this.queue.pollUpTo(max5);
      this.strategy.unsafeOnQueueEmptySpace(this.queue, this.takers);
      return fromIterable2(values3);
    }));
  }
  takeBetween(min3, max5) {
    return suspend(() => takeRemainderLoop(this, min3, max5, empty4()));
  }
}
var takeRemainderLoop = (self, min3, max5, acc) => {
  if (max5 < min3) {
    return succeed(acc);
  }
  return pipe(takeUpTo(self, max5), flatMap7((bs) => {
    const remaining = min3 - bs.length;
    if (remaining === 1) {
      return pipe(take2(self), map9((b) => pipe(acc, appendAll2(bs), append2(b))));
    }
    if (remaining > 1) {
      return pipe(take2(self), flatMap7((b) => takeRemainderLoop(self, remaining - 1, max5 - bs.length - 1, pipe(acc, appendAll2(bs), append2(b)))));
    }
    return succeed(pipe(acc, appendAll2(bs)));
  }));
};
var bounded2 = (requestedCapacity) => pipe(sync(() => bounded(requestedCapacity)), flatMap7((queue) => make42(backingQueueFromMutableQueue(queue), backPressureStrategy())));
var unbounded2 = () => pipe(sync(() => unbounded()), flatMap7((queue) => make42(backingQueueFromMutableQueue(queue), droppingStrategy())));
var unsafeMake8 = (queue, takers, shutdownHook, shutdownFlag, strategy) => {
  return new QueueImpl(queue, takers, shutdownHook, shutdownFlag, strategy);
};
var make42 = (queue, strategy) => pipe(deferredMake(), map9((deferred) => unsafeMake8(queue, unbounded(), deferred, make9(false), strategy)));

class BackingQueueFromMutableQueue {
  mutable;
  [BackingQueueTypeId] = backingQueueVariance;
  constructor(mutable) {
    this.mutable = mutable;
  }
  poll(def) {
    return poll2(this.mutable, def);
  }
  pollUpTo(limit) {
    return pollUpTo(this.mutable, limit);
  }
  offerAll(elements) {
    return offerAll(this.mutable, elements);
  }
  offer(element) {
    return offer(this.mutable, element);
  }
  capacity() {
    return capacity(this.mutable);
  }
  length() {
    return length2(this.mutable);
  }
}
var backingQueueFromMutableQueue = (mutable) => new BackingQueueFromMutableQueue(mutable);
var size11 = (self) => self.size;
var isShutdown = (self) => self.isShutdown;
var shutdown = (self) => self.shutdown;
var offer2 = /* @__PURE__ */ dual(2, (self, value) => self.offer(value));
var take2 = (self) => self.take;
var takeUpTo = /* @__PURE__ */ dual(2, (self, max5) => self.takeUpTo(max5));
var takeBetween = /* @__PURE__ */ dual(3, (self, min3, max5) => self.takeBetween(min3, max5));
var backPressureStrategy = () => new BackPressureStrategy;
var droppingStrategy = () => new DroppingStrategy;
class BackPressureStrategy {
  [QueueStrategyTypeId] = queueStrategyVariance;
  putters = unbounded();
  surplusSize() {
    return length2(this.putters);
  }
  onCompleteTakersWithEmptyQueue(takers) {
    while (!isEmpty9(this.putters) && !isEmpty9(takers)) {
      const taker = poll2(takers, undefined);
      const putter = poll2(this.putters, undefined);
      if (putter[2]) {
        unsafeCompleteDeferred(putter[1], true);
      }
      unsafeCompleteDeferred(taker, putter[0]);
    }
  }
  get shutdown() {
    return pipe(fiberId, flatMap7((fiberId2) => pipe(sync(() => unsafePollAll(this.putters)), flatMap7((putters) => forEachConcurrentDiscard(putters, ([_, deferred, isLastItem]) => isLastItem ? pipe(deferredInterruptWith(deferred, fiberId2), asUnit) : unit, false, false)))));
  }
  handleSurplus(iterable, queue, takers, isShutdown2) {
    return withFiberRuntime((state) => {
      const deferred = deferredUnsafeMake(state.id());
      return pipe(suspend(() => {
        this.unsafeOffer(iterable, deferred);
        this.unsafeOnQueueEmptySpace(queue, takers);
        unsafeCompleteTakers(this, queue, takers);
        return get6(isShutdown2) ? interrupt2 : deferredAwait(deferred);
      }), onInterrupt(() => sync(() => this.unsafeRemove(deferred))));
    });
  }
  unsafeOnQueueEmptySpace(queue, takers) {
    let keepPolling = true;
    while (keepPolling && (queue.capacity() === Number.POSITIVE_INFINITY || queue.length() < queue.capacity())) {
      const putter = pipe(this.putters, poll2(EmptyMutableQueue));
      if (putter === EmptyMutableQueue) {
        keepPolling = false;
      } else {
        const offered = queue.offer(putter[0]);
        if (offered && putter[2]) {
          unsafeCompleteDeferred(putter[1], true);
        } else if (!offered) {
          unsafeOfferAll(this.putters, pipe(unsafePollAll(this.putters), prepend2(putter)));
        }
        unsafeCompleteTakers(this, queue, takers);
      }
    }
  }
  unsafeOffer(iterable, deferred) {
    const stuff = Array.from(iterable);
    for (let i = 0;i < stuff.length; i++) {
      const value = stuff[i];
      if (i === stuff.length - 1) {
        pipe(this.putters, offer([value, deferred, true]));
      } else {
        pipe(this.putters, offer([value, deferred, false]));
      }
    }
  }
  unsafeRemove(deferred) {
    unsafeOfferAll(this.putters, pipe(unsafePollAll(this.putters), filter(([, _]) => _ !== deferred)));
  }
}

class DroppingStrategy {
  [QueueStrategyTypeId] = queueStrategyVariance;
  surplusSize() {
    return 0;
  }
  get shutdown() {
    return unit;
  }
  onCompleteTakersWithEmptyQueue() {}
  handleSurplus(_iterable, _queue, _takers, _isShutdown) {
    return succeed(false);
  }
  unsafeOnQueueEmptySpace(_queue, _takers) {}
}
var unsafeCompleteDeferred = (deferred, a) => {
  return deferredUnsafeDone(deferred, succeed(a));
};
var unsafeOfferAll = (queue, as5) => {
  return pipe(queue, offerAll(as5));
};
var unsafePollAll = (queue) => {
  return pipe(queue, pollUpTo(Number.POSITIVE_INFINITY));
};
var unsafePollN = (queue, max5) => {
  return pipe(queue, pollUpTo(max5));
};
var unsafeRemove = (queue, a) => {
  unsafeOfferAll(queue, pipe(unsafePollAll(queue), filter((b) => a !== b)));
};
var unsafeCompleteTakers = (strategy, queue, takers) => {
  let keepPolling = true;
  while (keepPolling && queue.length() !== 0) {
    const taker = pipe(takers, poll2(EmptyMutableQueue));
    if (taker !== EmptyMutableQueue) {
      const element = queue.poll(EmptyMutableQueue);
      if (element !== EmptyMutableQueue) {
        unsafeCompleteDeferred(taker, element);
        strategy.unsafeOnQueueEmptySpace(queue, takers);
      } else {
        unsafeOfferAll(takers, pipe(unsafePollAll(takers), prepend2(taker)));
      }
      keepPolling = true;
    } else {
      keepPolling = false;
    }
  }
  if (keepPolling && queue.length() === 0 && !isEmpty9(takers)) {
    strategy.onCompleteTakersWithEmptyQueue(takers);
  }
};

// node_modules/effect/dist/esm/Queue.js
var bounded3 = bounded2;
var unbounded3 = unbounded2;
var size12 = size11;
var isShutdown2 = isShutdown;
var shutdown2 = shutdown;
var offer3 = offer2;
var take3 = take2;
var takeBetween2 = takeBetween;

// node_modules/effect/dist/esm/internal/pubsub.js
var AbsentValue = /* @__PURE__ */ Symbol.for("effect/PubSub/AbsentValue");
var addSubscribers = (subscription, pollers) => (subscribers) => {
  if (!subscribers.has(subscription)) {
    subscribers.set(subscription, new Set);
  }
  const set7 = subscribers.get(subscription);
  set7.add(pollers);
};
var removeSubscribers = (subscription, pollers) => (subscribers) => {
  if (!subscribers.has(subscription)) {
    return;
  }
  const set7 = subscribers.get(subscription);
  set7.delete(pollers);
  if (set7.size === 0) {
    subscribers.delete(subscription);
  }
};
class UnboundedPubSub {
  publisherHead = {
    value: AbsentValue,
    subscribers: 0,
    next: null
  };
  publisherTail = this.publisherHead;
  publisherIndex = 0;
  subscribersIndex = 0;
  capacity = Number.MAX_SAFE_INTEGER;
  isEmpty() {
    return this.publisherHead === this.publisherTail;
  }
  isFull() {
    return false;
  }
  size() {
    return this.publisherIndex - this.subscribersIndex;
  }
  publish(value) {
    const subscribers = this.publisherTail.subscribers;
    if (subscribers !== 0) {
      this.publisherTail.next = {
        value,
        subscribers,
        next: null
      };
      this.publisherTail = this.publisherTail.next;
      this.publisherIndex += 1;
    }
    return true;
  }
  publishAll(elements) {
    for (const a of elements) {
      this.publish(a);
    }
    return empty4();
  }
  slide() {
    if (this.publisherHead !== this.publisherTail) {
      this.publisherHead = this.publisherHead.next;
      this.publisherHead.value = AbsentValue;
      this.subscribersIndex += 1;
    }
  }
  subscribe() {
    this.publisherTail.subscribers += 1;
    return new UnboundedPubSubSubscription(this, this.publisherTail, this.publisherIndex, false);
  }
}

class UnboundedPubSubSubscription {
  self;
  subscriberHead;
  subscriberIndex;
  unsubscribed;
  constructor(self, subscriberHead, subscriberIndex, unsubscribed) {
    this.self = self;
    this.subscriberHead = subscriberHead;
    this.subscriberIndex = subscriberIndex;
    this.unsubscribed = unsubscribed;
  }
  isEmpty() {
    if (this.unsubscribed) {
      return true;
    }
    let empty33 = true;
    let loop2 = true;
    while (loop2) {
      if (this.subscriberHead === this.self.publisherTail) {
        loop2 = false;
      } else {
        if (this.subscriberHead.next.value !== AbsentValue) {
          empty33 = false;
          loop2 = false;
        } else {
          this.subscriberHead = this.subscriberHead.next;
          this.subscriberIndex += 1;
        }
      }
    }
    return empty33;
  }
  size() {
    if (this.unsubscribed) {
      return 0;
    }
    return this.self.publisherIndex - Math.max(this.subscriberIndex, this.self.subscribersIndex);
  }
  poll(default_) {
    if (this.unsubscribed) {
      return default_;
    }
    let loop2 = true;
    let polled = default_;
    while (loop2) {
      if (this.subscriberHead === this.self.publisherTail) {
        loop2 = false;
      } else {
        const elem = this.subscriberHead.next.value;
        if (elem !== AbsentValue) {
          polled = elem;
          this.subscriberHead.subscribers -= 1;
          if (this.subscriberHead.subscribers === 0) {
            this.self.publisherHead = this.self.publisherHead.next;
            this.self.publisherHead.value = AbsentValue;
            this.self.subscribersIndex += 1;
          }
          loop2 = false;
        }
        this.subscriberHead = this.subscriberHead.next;
        this.subscriberIndex += 1;
      }
    }
    return polled;
  }
  pollUpTo(n) {
    const builder = [];
    const default_ = AbsentValue;
    let i = 0;
    while (i !== n) {
      const a = this.poll(default_);
      if (a === default_) {
        i = n;
      } else {
        builder.push(a);
        i += 1;
      }
    }
    return fromIterable2(builder);
  }
  unsubscribe() {
    if (!this.unsubscribed) {
      this.unsubscribed = true;
      this.self.publisherTail.subscribers -= 1;
      while (this.subscriberHead !== this.self.publisherTail) {
        if (this.subscriberHead.next.value !== AbsentValue) {
          this.subscriberHead.subscribers -= 1;
          if (this.subscriberHead.subscribers === 0) {
            this.self.publisherHead = this.self.publisherHead.next;
            this.self.publisherHead.value = AbsentValue;
            this.self.subscribersIndex += 1;
          }
        }
        this.subscriberHead = this.subscriberHead.next;
      }
    }
  }
}
var unsafeCompleteDeferred2 = (deferred, a) => {
  deferredUnsafeDone(deferred, succeed(a));
};
var unsafeOfferAll2 = (queue, as5) => {
  return pipe(queue, offerAll(as5));
};
var unsafePollAllQueue = (queue) => {
  return pipe(queue, pollUpTo(Number.POSITIVE_INFINITY));
};
class BackPressureStrategy2 {
  publishers = unbounded();
  get shutdown() {
    return flatMap7(fiberId, (fiberId2) => flatMap7(sync(() => unsafePollAllQueue(this.publishers)), (publishers) => forEachConcurrentDiscard(publishers, ([_, deferred, last3]) => last3 ? pipe(deferredInterruptWith(deferred, fiberId2), asUnit) : unit, false, false)));
  }
  handleSurplus(pubsub, subscribers, elements, isShutdown3) {
    return withFiberRuntime((state) => {
      const deferred = deferredUnsafeMake(state.id());
      return pipe(suspend(() => {
        this.unsafeOffer(elements, deferred);
        this.unsafeOnPubSubEmptySpace(pubsub, subscribers);
        this.unsafeCompleteSubscribers(pubsub, subscribers);
        return get6(isShutdown3) ? interrupt2 : deferredAwait(deferred);
      }), onInterrupt(() => sync(() => this.unsafeRemove(deferred))));
    });
  }
  unsafeOnPubSubEmptySpace(pubsub, subscribers) {
    let keepPolling = true;
    while (keepPolling && !pubsub.isFull()) {
      const publisher = pipe(this.publishers, poll2(EmptyMutableQueue));
      if (publisher === EmptyMutableQueue) {
        keepPolling = false;
      } else {
        const published = pubsub.publish(publisher[0]);
        if (published && publisher[2]) {
          unsafeCompleteDeferred2(publisher[1], true);
        } else if (!published) {
          unsafeOfferAll2(this.publishers, pipe(unsafePollAllQueue(this.publishers), prepend2(publisher)));
        }
        this.unsafeCompleteSubscribers(pubsub, subscribers);
      }
    }
  }
  unsafeCompletePollers(pubsub, subscribers, subscription, pollers) {
    return unsafeStrategyCompletePollers(this, pubsub, subscribers, subscription, pollers);
  }
  unsafeCompleteSubscribers(pubsub, subscribers) {
    return unsafeStrategyCompleteSubscribers(this, pubsub, subscribers);
  }
  unsafeOffer(elements, deferred) {
    const iterator = elements[Symbol.iterator]();
    let next4 = iterator.next();
    if (!next4.done) {
      while (true) {
        const value = next4.value;
        next4 = iterator.next();
        if (next4.done) {
          pipe(this.publishers, offer([value, deferred, true]));
          break;
        }
        pipe(this.publishers, offer([value, deferred, false]));
      }
    }
  }
  unsafeRemove(deferred) {
    unsafeOfferAll2(this.publishers, pipe(unsafePollAllQueue(this.publishers), filter(([_, a]) => a !== deferred)));
  }
}
var unsafeStrategyCompletePollers = (strategy, pubsub, subscribers, subscription, pollers) => {
  let keepPolling = true;
  while (keepPolling && !subscription.isEmpty()) {
    const poller = pipe(pollers, poll2(EmptyMutableQueue));
    if (poller === EmptyMutableQueue) {
      pipe(subscribers, removeSubscribers(subscription, pollers));
      if (isEmpty9(pollers)) {
        keepPolling = false;
      } else {
        pipe(subscribers, addSubscribers(subscription, pollers));
      }
    } else {
      const pollResult = subscription.poll(EmptyMutableQueue);
      if (pollResult === EmptyMutableQueue) {
        unsafeOfferAll2(pollers, pipe(unsafePollAllQueue(pollers), prepend2(poller)));
      } else {
        unsafeCompleteDeferred2(poller, pollResult);
        strategy.unsafeOnPubSubEmptySpace(pubsub, subscribers);
      }
    }
  }
};
var unsafeStrategyCompleteSubscribers = (strategy, pubsub, subscribers) => {
  for (const [subscription, pollersSet] of subscribers) {
    for (const pollers of pollersSet) {
      strategy.unsafeCompletePollers(pubsub, subscribers, subscription, pollers);
    }
  }
};

// node_modules/effect/dist/esm/internal/opCodes/channelChildExecutorDecision.js
var OP_CONTINUE2 = "Continue";
var OP_CLOSE = "Close";
var OP_YIELD2 = "Yield";

// node_modules/effect/dist/esm/internal/channel/childExecutorDecision.js
var ChildExecutorDecisionSymbolKey = "effect/ChannelChildExecutorDecision";
var ChildExecutorDecisionTypeId = /* @__PURE__ */ Symbol.for(ChildExecutorDecisionSymbolKey);
var proto4 = {
  [ChildExecutorDecisionTypeId]: ChildExecutorDecisionTypeId
};
var Continue = (_) => {
  const op = Object.create(proto4);
  op._tag = OP_CONTINUE2;
  return op;
};

// node_modules/effect/dist/esm/internal/opCodes/continuation.js
var OP_CONTINUATION_K = "ContinuationK";
var OP_CONTINUATION_FINALIZER = "ContinuationFinalizer";

// node_modules/effect/dist/esm/internal/channel/continuation.js
var ContinuationTypeId = /* @__PURE__ */ Symbol.for("effect/ChannelContinuation");
var continuationVariance = {
  _Env: (_) => _,
  _InErr: (_) => _,
  _InElem: (_) => _,
  _InDone: (_) => _,
  _OutErr: (_) => _,
  _OutDone: (_) => _,
  _OutErr2: (_) => _,
  _OutElem: (_) => _,
  _OutDone2: (_) => _
};

class ContinuationKImpl {
  onSuccess;
  onHalt;
  _tag = OP_CONTINUATION_K;
  [ContinuationTypeId] = continuationVariance;
  constructor(onSuccess, onHalt) {
    this.onSuccess = onSuccess;
    this.onHalt = onHalt;
  }
  onExit(exit3) {
    return isFailure(exit3) ? this.onHalt(exit3.cause) : this.onSuccess(exit3.value);
  }
}

class ContinuationFinalizerImpl {
  finalizer;
  _tag = OP_CONTINUATION_FINALIZER;
  [ContinuationTypeId] = continuationVariance;
  constructor(finalizer) {
    this.finalizer = finalizer;
  }
}

// node_modules/effect/dist/esm/internal/opCodes/channelUpstreamPullStrategy.js
var OP_PULL_AFTER_NEXT = "PullAfterNext";
var OP_PULL_AFTER_ALL_ENQUEUED = "PullAfterAllEnqueued";

// node_modules/effect/dist/esm/internal/channel/upstreamPullStrategy.js
var UpstreamPullStrategySymbolKey = "effect/ChannelUpstreamPullStrategy";
var UpstreamPullStrategyTypeId = /* @__PURE__ */ Symbol.for(UpstreamPullStrategySymbolKey);
var upstreamPullStrategyVariance = {
  _A: (_) => _
};
var proto5 = {
  [UpstreamPullStrategyTypeId]: upstreamPullStrategyVariance
};
var PullAfterNext = (emitSeparator) => {
  const op = Object.create(proto5);
  op._tag = OP_PULL_AFTER_NEXT;
  op.emitSeparator = emitSeparator;
  return op;
};

// node_modules/effect/dist/esm/internal/opCodes/channel.js
var OP_BRACKET_OUT = "BracketOut";
var OP_BRIDGE = "Bridge";
var OP_CONCAT_ALL = "ConcatAll";
var OP_EMIT = "Emit";
var OP_ENSURING = "Ensuring";
var OP_FAIL3 = "Fail";
var OP_FOLD2 = "Fold";
var OP_FROM_EFFECT2 = "FromEffect";
var OP_PIPE_TO = "PipeTo";
var OP_PROVIDE2 = "Provide";
var OP_READ = "Read";
var OP_SUCCEED = "Succeed";
var OP_SUCCEED_NOW = "SucceedNow";
var OP_SUSPEND2 = "Suspend";

// node_modules/effect/dist/esm/internal/core-stream.js
var ChannelSymbolKey = "effect/Channel";
var ChannelTypeId2 = /* @__PURE__ */ Symbol.for(ChannelSymbolKey);
var channelVariance2 = {
  _Env: (_) => _,
  _InErr: (_) => _,
  _InElem: (_) => _,
  _InDone: (_) => _,
  _OutErr: (_) => _,
  _OutElem: (_) => _,
  _OutDone: (_) => _
};
var proto6 = {
  [ChannelTypeId2]: channelVariance2,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isChannel = (u) => hasProperty(u, ChannelTypeId2) || isEffect2(u);
var acquireReleaseOut = /* @__PURE__ */ dual(2, (self, release) => {
  const op = Object.create(proto6);
  op._tag = OP_BRACKET_OUT;
  op.acquire = () => self;
  op.finalizer = release;
  return op;
});
var concatAllWith = (channels, f, g) => {
  const op = Object.create(proto6);
  op._tag = OP_CONCAT_ALL;
  op.combineInners = f;
  op.combineAll = g;
  op.onPull = () => PullAfterNext(none2());
  op.onEmit = () => Continue;
  op.value = () => channels;
  op.k = identity;
  return op;
};
var concatMapWith = /* @__PURE__ */ dual(4, (self, f, g, h) => {
  const op = Object.create(proto6);
  op._tag = OP_CONCAT_ALL;
  op.combineInners = g;
  op.combineAll = h;
  op.onPull = () => PullAfterNext(none2());
  op.onEmit = () => Continue;
  op.value = () => self;
  op.k = f;
  return op;
});
var embedInput = /* @__PURE__ */ dual(2, (self, input) => {
  const op = Object.create(proto6);
  op._tag = OP_BRIDGE;
  op.input = input;
  op.channel = self;
  return op;
});
var ensuringWith = /* @__PURE__ */ dual(2, (self, finalizer) => {
  const op = Object.create(proto6);
  op._tag = OP_ENSURING;
  op.channel = self;
  op.finalizer = finalizer;
  return op;
});
var fail9 = (error) => failCause8(fail4(error));
var failCause8 = (cause2) => failCauseSync3(() => cause2);
var failCauseSync3 = (evaluate) => {
  const op = Object.create(proto6);
  op._tag = OP_FAIL3;
  op.error = evaluate;
  return op;
};
var flatMap10 = /* @__PURE__ */ dual(2, (self, f) => {
  const op = Object.create(proto6);
  op._tag = OP_FOLD2;
  op.channel = self;
  op.k = new ContinuationKImpl(f, failCause8);
  return op;
});
var fromEffect4 = (effect2) => {
  const op = Object.create(proto6);
  op._tag = OP_FROM_EFFECT2;
  op.effect = () => effect2;
  return op;
};
var pipeTo = /* @__PURE__ */ dual(2, (self, that) => {
  const op = Object.create(proto6);
  op._tag = OP_PIPE_TO;
  op.left = () => self;
  op.right = () => that;
  return op;
});
var readWith = (options) => readWithCause({
  onInput: options.onInput,
  onFailure: (cause2) => match2(failureOrCause2(cause2), {
    onLeft: options.onFailure,
    onRight: failCause8
  }),
  onDone: options.onDone
});
var readWithCause = (options) => {
  const op = Object.create(proto6);
  op._tag = OP_READ;
  op.more = options.onInput;
  op.done = new ContinuationKImpl(options.onDone, options.onFailure);
  return op;
};
var succeed10 = (value) => sync5(() => value);
var succeedNow = (result) => {
  const op = Object.create(proto6);
  op._tag = OP_SUCCEED_NOW;
  op.terminal = result;
  return op;
};
var suspend4 = (evaluate) => {
  const op = Object.create(proto6);
  op._tag = OP_SUSPEND2;
  op.channel = evaluate;
  return op;
};
var sync5 = (evaluate) => {
  const op = Object.create(proto6);
  op._tag = OP_SUCCEED;
  op.evaluate = evaluate;
  return op;
};
var unit5 = /* @__PURE__ */ succeedNow(undefined);
var write = (out) => {
  const op = Object.create(proto6);
  op._tag = OP_EMIT;
  op.out = out;
  return op;
};

// node_modules/effect/dist/esm/internal/opCodes/channelState.js
var OP_DONE3 = "Done";
var OP_EMIT2 = "Emit";
var OP_FROM_EFFECT3 = "FromEffect";
var OP_READ2 = "Read";

// node_modules/effect/dist/esm/internal/channel/channelState.js
var ChannelStateTypeId = /* @__PURE__ */ Symbol.for("effect/ChannelState");
var channelStateVariance = {
  _E: (_) => _,
  _R: (_) => _
};
var proto7 = {
  [ChannelStateTypeId]: channelStateVariance
};
var Done2 = () => {
  const op = Object.create(proto7);
  op._tag = OP_DONE3;
  return op;
};
var Emit = () => {
  const op = Object.create(proto7);
  op._tag = OP_EMIT2;
  return op;
};
var fromEffect5 = (effect2) => {
  const op = Object.create(proto7);
  op._tag = OP_FROM_EFFECT3;
  op.effect = effect2;
  return op;
};
var Read = (upstream, onEffect, onEmit, onDone) => {
  const op = Object.create(proto7);
  op._tag = OP_READ2;
  op.upstream = upstream;
  op.onEffect = onEffect;
  op.onEmit = onEmit;
  op.onDone = onDone;
  return op;
};
var isFromEffect = (self) => self._tag === OP_FROM_EFFECT3;
var effect2 = (self) => isFromEffect(self) ? self.effect : unit4;
var effectOrUndefinedIgnored = (self) => isFromEffect(self) ? ignore2(self.effect) : undefined;

// node_modules/effect/dist/esm/internal/channel/subexecutor.js
var OP_PULL_FROM_CHILD = "PullFromChild";
var OP_PULL_FROM_UPSTREAM = "PullFromUpstream";
var OP_DRAIN_CHILD_EXECUTORS = "DrainChildExecutors";
var OP_EMIT3 = "Emit";

class PullFromChild {
  childExecutor;
  parentSubexecutor;
  onEmit;
  _tag = OP_PULL_FROM_CHILD;
  constructor(childExecutor, parentSubexecutor, onEmit) {
    this.childExecutor = childExecutor;
    this.parentSubexecutor = parentSubexecutor;
    this.onEmit = onEmit;
  }
  close(exit3) {
    const fin1 = this.childExecutor.close(exit3);
    const fin2 = this.parentSubexecutor.close(exit3);
    if (fin1 !== undefined && fin2 !== undefined) {
      return zipWith5(exit2(fin1), exit2(fin2), (exit1, exit22) => pipe(exit1, zipRight2(exit22)));
    } else if (fin1 !== undefined) {
      return fin1;
    } else if (fin2 !== undefined) {
      return fin2;
    } else {
      return;
    }
  }
  enqueuePullFromChild(_child) {
    return this;
  }
}

class PullFromUpstream {
  upstreamExecutor;
  createChild;
  lastDone;
  activeChildExecutors;
  combineChildResults;
  combineWithChildResult;
  onPull;
  onEmit;
  _tag = OP_PULL_FROM_UPSTREAM;
  constructor(upstreamExecutor, createChild, lastDone, activeChildExecutors, combineChildResults, combineWithChildResult, onPull, onEmit) {
    this.upstreamExecutor = upstreamExecutor;
    this.createChild = createChild;
    this.lastDone = lastDone;
    this.activeChildExecutors = activeChildExecutors;
    this.combineChildResults = combineChildResults;
    this.combineWithChildResult = combineWithChildResult;
    this.onPull = onPull;
    this.onEmit = onEmit;
  }
  close(exit3) {
    const fin1 = this.upstreamExecutor.close(exit3);
    const fins = [...this.activeChildExecutors.map((child) => child !== undefined ? child.childExecutor.close(exit3) : undefined), fin1];
    const result = fins.reduce((acc, next4) => {
      if (acc !== undefined && next4 !== undefined) {
        return zipWith5(acc, exit2(next4), (exit1, exit22) => zipRight2(exit1, exit22));
      } else if (acc !== undefined) {
        return acc;
      } else if (next4 !== undefined) {
        return exit2(next4);
      } else {
        return;
      }
    }, undefined);
    return result === undefined ? result : result;
  }
  enqueuePullFromChild(child) {
    return new PullFromUpstream(this.upstreamExecutor, this.createChild, this.lastDone, [...this.activeChildExecutors, child], this.combineChildResults, this.combineWithChildResult, this.onPull, this.onEmit);
  }
}

class DrainChildExecutors {
  upstreamExecutor;
  lastDone;
  activeChildExecutors;
  upstreamDone;
  combineChildResults;
  combineWithChildResult;
  onPull;
  _tag = OP_DRAIN_CHILD_EXECUTORS;
  constructor(upstreamExecutor, lastDone, activeChildExecutors, upstreamDone, combineChildResults, combineWithChildResult, onPull) {
    this.upstreamExecutor = upstreamExecutor;
    this.lastDone = lastDone;
    this.activeChildExecutors = activeChildExecutors;
    this.upstreamDone = upstreamDone;
    this.combineChildResults = combineChildResults;
    this.combineWithChildResult = combineWithChildResult;
    this.onPull = onPull;
  }
  close(exit3) {
    const fin1 = this.upstreamExecutor.close(exit3);
    const fins = [...this.activeChildExecutors.map((child) => child !== undefined ? child.childExecutor.close(exit3) : undefined), fin1];
    const result = fins.reduce((acc, next4) => {
      if (acc !== undefined && next4 !== undefined) {
        return zipWith5(acc, exit2(next4), (exit1, exit22) => zipRight2(exit1, exit22));
      } else if (acc !== undefined) {
        return acc;
      } else if (next4 !== undefined) {
        return exit2(next4);
      } else {
        return;
      }
    }, undefined);
    return result === undefined ? result : result;
  }
  enqueuePullFromChild(child) {
    return new DrainChildExecutors(this.upstreamExecutor, this.lastDone, [...this.activeChildExecutors, child], this.upstreamDone, this.combineChildResults, this.combineWithChildResult, this.onPull);
  }
}

class Emit2 {
  value;
  next;
  _tag = OP_EMIT3;
  constructor(value, next4) {
    this.value = value;
    this.next = next4;
  }
  close(exit3) {
    const result = this.next.close(exit3);
    return result === undefined ? result : result;
  }
  enqueuePullFromChild(_child) {
    return this;
  }
}

// node_modules/effect/dist/esm/internal/opCodes/channelUpstreamPullRequest.js
var OP_PULLED = "Pulled";
var OP_NO_UPSTREAM = "NoUpstream";

// node_modules/effect/dist/esm/internal/channel/upstreamPullRequest.js
var UpstreamPullRequestSymbolKey = "effect/ChannelUpstreamPullRequest";
var UpstreamPullRequestTypeId = /* @__PURE__ */ Symbol.for(UpstreamPullRequestSymbolKey);
var upstreamPullRequestVariance = {
  _A: (_) => _
};
var proto8 = {
  [UpstreamPullRequestTypeId]: upstreamPullRequestVariance
};
var Pulled = (value) => {
  const op = Object.create(proto8);
  op._tag = OP_PULLED;
  op.value = value;
  return op;
};
var NoUpstream = (activeDownstreamCount) => {
  const op = Object.create(proto8);
  op._tag = OP_NO_UPSTREAM;
  op.activeDownstreamCount = activeDownstreamCount;
  return op;
};

// node_modules/effect/dist/esm/internal/channel/channelExecutor.js
class ChannelExecutor {
  _activeSubexecutor = undefined;
  _cancelled = undefined;
  _closeLastSubstream = undefined;
  _currentChannel;
  _done = undefined;
  _doneStack = [];
  _emitted = undefined;
  _executeCloseLastSubstream;
  _input = undefined;
  _inProgressFinalizer = undefined;
  _providedEnv;
  constructor(initialChannel, providedEnv, executeCloseLastSubstream) {
    this._currentChannel = initialChannel;
    this._executeCloseLastSubstream = executeCloseLastSubstream;
    this._providedEnv = providedEnv;
  }
  run() {
    let result = undefined;
    while (result === undefined) {
      if (this._cancelled !== undefined) {
        result = this.processCancellation();
      } else if (this._activeSubexecutor !== undefined) {
        result = this.runSubexecutor();
      } else {
        try {
          if (this._currentChannel === undefined) {
            result = Done2();
          } else {
            if (isEffect2(this._currentChannel)) {
              this._currentChannel = fromEffect4(this._currentChannel);
            } else {
              switch (this._currentChannel._tag) {
                case OP_BRACKET_OUT: {
                  result = this.runBracketOut(this._currentChannel);
                  break;
                }
                case OP_BRIDGE: {
                  const bridgeInput = this._currentChannel.input;
                  this._currentChannel = this._currentChannel.channel;
                  if (this._input !== undefined) {
                    const inputExecutor = this._input;
                    this._input = undefined;
                    const drainer = () => flatMap8(bridgeInput.awaitRead(), () => suspend3(() => {
                      const state = inputExecutor.run();
                      switch (state._tag) {
                        case OP_DONE3: {
                          return match9(inputExecutor.getDone(), {
                            onFailure: (cause2) => bridgeInput.error(cause2),
                            onSuccess: (value) => bridgeInput.done(value)
                          });
                        }
                        case OP_EMIT2: {
                          return flatMap8(bridgeInput.emit(inputExecutor.getEmit()), () => drainer());
                        }
                        case OP_FROM_EFFECT3: {
                          return matchCauseEffect2(state.effect, {
                            onFailure: (cause2) => bridgeInput.error(cause2),
                            onSuccess: () => drainer()
                          });
                        }
                        case OP_READ2: {
                          return readUpstream(state, () => drainer(), (cause2) => bridgeInput.error(cause2));
                        }
                      }
                    }));
                    result = fromEffect5(flatMap8(forkDaemon2(drainer()), (fiber) => sync2(() => this.addFinalizer((exit3) => flatMap8(interrupt5(fiber), () => suspend3(() => {
                      const effect3 = this.restorePipe(exit3, inputExecutor);
                      return effect3 !== undefined ? effect3 : unit4;
                    }))))));
                  }
                  break;
                }
                case OP_CONCAT_ALL: {
                  const executor = new ChannelExecutor(this._currentChannel.value(), this._providedEnv, (effect3) => sync2(() => {
                    const prevLastClose = this._closeLastSubstream === undefined ? unit4 : this._closeLastSubstream;
                    this._closeLastSubstream = pipe(prevLastClose, zipRight3(effect3));
                  }));
                  executor._input = this._input;
                  const channel = this._currentChannel;
                  this._activeSubexecutor = new PullFromUpstream(executor, (value) => channel.k(value), undefined, [], (x, y) => channel.combineInners(x, y), (x, y) => channel.combineAll(x, y), (request) => channel.onPull(request), (value) => channel.onEmit(value));
                  this._closeLastSubstream = undefined;
                  this._currentChannel = undefined;
                  break;
                }
                case OP_EMIT: {
                  this._emitted = this._currentChannel.out;
                  this._currentChannel = this._activeSubexecutor !== undefined ? undefined : unit5;
                  result = Emit();
                  break;
                }
                case OP_ENSURING: {
                  this.runEnsuring(this._currentChannel);
                  break;
                }
                case OP_FAIL3: {
                  result = this.doneHalt(this._currentChannel.error());
                  break;
                }
                case OP_FOLD2: {
                  this._doneStack.push(this._currentChannel.k);
                  this._currentChannel = this._currentChannel.channel;
                  break;
                }
                case OP_FROM_EFFECT2: {
                  const effect3 = this._providedEnv === undefined ? this._currentChannel.effect() : pipe(this._currentChannel.effect(), provide(this._providedEnv));
                  result = fromEffect5(matchCauseEffect2(effect3, {
                    onFailure: (cause2) => {
                      const state = this.doneHalt(cause2);
                      return state !== undefined && isFromEffect(state) ? state.effect : unit4;
                    },
                    onSuccess: (value) => {
                      const state = this.doneSucceed(value);
                      return state !== undefined && isFromEffect(state) ? state.effect : unit4;
                    }
                  }));
                  break;
                }
                case OP_PIPE_TO: {
                  const previousInput = this._input;
                  const leftExec = new ChannelExecutor(this._currentChannel.left(), this._providedEnv, (effect3) => this._executeCloseLastSubstream(effect3));
                  leftExec._input = previousInput;
                  this._input = leftExec;
                  this.addFinalizer((exit3) => {
                    const effect3 = this.restorePipe(exit3, previousInput);
                    return effect3 !== undefined ? effect3 : unit4;
                  });
                  this._currentChannel = this._currentChannel.right();
                  break;
                }
                case OP_PROVIDE2: {
                  const previousEnv = this._providedEnv;
                  this._providedEnv = this._currentChannel.context();
                  this._currentChannel = this._currentChannel.inner;
                  this.addFinalizer(() => sync2(() => {
                    this._providedEnv = previousEnv;
                  }));
                  break;
                }
                case OP_READ: {
                  const read = this._currentChannel;
                  result = Read(this._input, identity, (emitted) => {
                    try {
                      this._currentChannel = read.more(emitted);
                    } catch (error) {
                      this._currentChannel = read.done.onExit(die3(error));
                    }
                    return;
                  }, (exit3) => {
                    const onExit2 = (exit4) => {
                      return read.done.onExit(exit4);
                    };
                    this._currentChannel = onExit2(exit3);
                    return;
                  });
                  break;
                }
                case OP_SUCCEED: {
                  result = this.doneSucceed(this._currentChannel.evaluate());
                  break;
                }
                case OP_SUCCEED_NOW: {
                  result = this.doneSucceed(this._currentChannel.terminal);
                  break;
                }
                case OP_SUSPEND2: {
                  this._currentChannel = this._currentChannel.channel();
                  break;
                }
                default: {
                  this._currentChannel._tag;
                }
              }
            }
          }
        } catch (error) {
          this._currentChannel = failCause8(die4(error));
        }
      }
    }
    return result;
  }
  getDone() {
    return this._done;
  }
  getEmit() {
    return this._emitted;
  }
  cancelWith(exit3) {
    this._cancelled = exit3;
  }
  clearInProgressFinalizer() {
    this._inProgressFinalizer = undefined;
  }
  storeInProgressFinalizer(finalizer) {
    this._inProgressFinalizer = finalizer;
  }
  popAllFinalizers(exit3) {
    const finalizers = [];
    let next4 = this._doneStack.pop();
    while (next4) {
      if (next4._tag === "ContinuationFinalizer") {
        finalizers.push(next4.finalizer);
      }
      next4 = this._doneStack.pop();
    }
    const effect3 = finalizers.length === 0 ? unit4 : runFinalizers(finalizers, exit3);
    this.storeInProgressFinalizer(effect3);
    return effect3;
  }
  popNextFinalizers() {
    const builder = [];
    while (this._doneStack.length !== 0) {
      const cont = this._doneStack[this._doneStack.length - 1];
      if (cont._tag === OP_CONTINUATION_K) {
        return builder;
      }
      builder.push(cont);
      this._doneStack.pop();
    }
    return builder;
  }
  restorePipe(exit3, prev) {
    const currInput = this._input;
    this._input = prev;
    if (currInput !== undefined) {
      const effect3 = currInput.close(exit3);
      return effect3;
    }
    return unit4;
  }
  close(exit3) {
    let runInProgressFinalizers = undefined;
    const finalizer = this._inProgressFinalizer;
    if (finalizer !== undefined) {
      runInProgressFinalizers = pipe(finalizer, ensuring2(sync2(() => this.clearInProgressFinalizer())));
    }
    let closeSelf = undefined;
    const selfFinalizers = this.popAllFinalizers(exit3);
    if (selfFinalizers !== undefined) {
      closeSelf = pipe(selfFinalizers, ensuring2(sync2(() => this.clearInProgressFinalizer())));
    }
    const closeSubexecutors = this._activeSubexecutor === undefined ? undefined : this._activeSubexecutor.close(exit3);
    if (closeSubexecutors === undefined && runInProgressFinalizers === undefined && closeSelf === undefined) {
      return;
    }
    return pipe(exit2(ifNotNull(closeSubexecutors)), zip5(exit2(ifNotNull(runInProgressFinalizers))), zip5(exit2(ifNotNull(closeSelf))), map15(([[exit1, exit22], exit32]) => pipe(exit1, zipRight2(exit22), zipRight2(exit32))), uninterruptible2, flatMap8((exit4) => suspend3(() => exit4)));
  }
  doneSucceed(value) {
    if (this._doneStack.length === 0) {
      this._done = succeed3(value);
      this._currentChannel = undefined;
      return Done2();
    }
    const head4 = this._doneStack[this._doneStack.length - 1];
    if (head4._tag === OP_CONTINUATION_K) {
      this._doneStack.pop();
      this._currentChannel = head4.onSuccess(value);
      return;
    }
    const finalizers = this.popNextFinalizers();
    if (this._doneStack.length === 0) {
      this._doneStack = finalizers.reverse();
      this._done = succeed3(value);
      this._currentChannel = undefined;
      return Done2();
    }
    const finalizerEffect = runFinalizers(finalizers.map((f) => f.finalizer), succeed3(value));
    this.storeInProgressFinalizer(finalizerEffect);
    const effect3 = pipe(finalizerEffect, ensuring2(sync2(() => this.clearInProgressFinalizer())), uninterruptible2, flatMap8(() => sync2(() => this.doneSucceed(value))));
    return fromEffect5(effect3);
  }
  doneHalt(cause2) {
    if (this._doneStack.length === 0) {
      this._done = failCause3(cause2);
      this._currentChannel = undefined;
      return Done2();
    }
    const head4 = this._doneStack[this._doneStack.length - 1];
    if (head4._tag === OP_CONTINUATION_K) {
      this._doneStack.pop();
      this._currentChannel = head4.onHalt(cause2);
      return;
    }
    const finalizers = this.popNextFinalizers();
    if (this._doneStack.length === 0) {
      this._doneStack = finalizers.reverse();
      this._done = failCause3(cause2);
      this._currentChannel = undefined;
      return Done2();
    }
    const finalizerEffect = runFinalizers(finalizers.map((f) => f.finalizer), failCause3(cause2));
    this.storeInProgressFinalizer(finalizerEffect);
    const effect3 = pipe(finalizerEffect, ensuring2(sync2(() => this.clearInProgressFinalizer())), uninterruptible2, flatMap8(() => sync2(() => this.doneHalt(cause2))));
    return fromEffect5(effect3);
  }
  processCancellation() {
    this._currentChannel = undefined;
    this._done = this._cancelled;
    this._cancelled = undefined;
    return Done2();
  }
  runBracketOut(bracketOut) {
    const effect3 = uninterruptible2(matchCauseEffect2(this.provide(bracketOut.acquire()), {
      onFailure: (cause2) => sync2(() => {
        this._currentChannel = failCause8(cause2);
      }),
      onSuccess: (out) => sync2(() => {
        this.addFinalizer((exit3) => this.provide(bracketOut.finalizer(out, exit3)));
        this._currentChannel = write(out);
      })
    }));
    return fromEffect5(effect3);
  }
  provide(effect3) {
    if (this._providedEnv === undefined) {
      return effect3;
    }
    return pipe(effect3, provide(this._providedEnv));
  }
  runEnsuring(ensuring4) {
    this.addFinalizer(ensuring4.finalizer);
    this._currentChannel = ensuring4.channel;
  }
  addFinalizer(f) {
    this._doneStack.push(new ContinuationFinalizerImpl(f));
  }
  runSubexecutor() {
    const subexecutor = this._activeSubexecutor;
    switch (subexecutor._tag) {
      case OP_PULL_FROM_CHILD: {
        return this.pullFromChild(subexecutor.childExecutor, subexecutor.parentSubexecutor, subexecutor.onEmit, subexecutor);
      }
      case OP_PULL_FROM_UPSTREAM: {
        return this.pullFromUpstream(subexecutor);
      }
      case OP_DRAIN_CHILD_EXECUTORS: {
        return this.drainChildExecutors(subexecutor);
      }
      case OP_EMIT3: {
        this._emitted = subexecutor.value;
        this._activeSubexecutor = subexecutor.next;
        return Emit();
      }
    }
  }
  replaceSubexecutor(nextSubExec) {
    this._currentChannel = undefined;
    this._activeSubexecutor = nextSubExec;
  }
  finishWithExit(exit3) {
    const state = match9(exit3, {
      onFailure: (cause2) => this.doneHalt(cause2),
      onSuccess: (value) => this.doneSucceed(value)
    });
    this._activeSubexecutor = undefined;
    return state === undefined ? unit4 : effect2(state);
  }
  finishSubexecutorWithCloseEffect(subexecutorDone, ...closeFuncs) {
    this.addFinalizer(() => pipe(closeFuncs, forEach7((closeFunc) => pipe(sync2(() => closeFunc(subexecutorDone)), flatMap8((closeEffect) => closeEffect !== undefined ? closeEffect : unit4)), {
      discard: true
    })));
    const state = pipe(subexecutorDone, match9({
      onFailure: (cause2) => this.doneHalt(cause2),
      onSuccess: (value) => this.doneSucceed(value)
    }));
    this._activeSubexecutor = undefined;
    return state;
  }
  applyUpstreamPullStrategy(upstreamFinished, queue, strategy) {
    switch (strategy._tag) {
      case OP_PULL_AFTER_NEXT: {
        const shouldPrepend = !upstreamFinished || queue.some((subexecutor) => subexecutor !== undefined);
        return [strategy.emitSeparator, shouldPrepend ? [undefined, ...queue] : queue];
      }
      case OP_PULL_AFTER_ALL_ENQUEUED: {
        const shouldEnqueue = !upstreamFinished || queue.some((subexecutor) => subexecutor !== undefined);
        return [strategy.emitSeparator, shouldEnqueue ? [...queue, undefined] : queue];
      }
    }
  }
  pullFromChild(childExecutor, parentSubexecutor, onEmitted, subexecutor) {
    return Read(childExecutor, identity, (emitted) => {
      const childExecutorDecision = onEmitted(emitted);
      switch (childExecutorDecision._tag) {
        case OP_CONTINUE2: {
          break;
        }
        case OP_CLOSE: {
          this.finishWithDoneValue(childExecutor, parentSubexecutor, childExecutorDecision.value);
          break;
        }
        case OP_YIELD2: {
          const modifiedParent = parentSubexecutor.enqueuePullFromChild(subexecutor);
          this.replaceSubexecutor(modifiedParent);
          break;
        }
      }
      this._activeSubexecutor = new Emit2(emitted, this._activeSubexecutor);
      return;
    }, match9({
      onFailure: (cause2) => {
        const state = this.handleSubexecutorFailure(childExecutor, parentSubexecutor, cause2);
        return state === undefined ? undefined : effectOrUndefinedIgnored(state);
      },
      onSuccess: (doneValue) => {
        this.finishWithDoneValue(childExecutor, parentSubexecutor, doneValue);
        return;
      }
    }));
  }
  finishWithDoneValue(childExecutor, parentSubexecutor, doneValue) {
    const subexecutor = parentSubexecutor;
    switch (subexecutor._tag) {
      case OP_PULL_FROM_UPSTREAM: {
        const modifiedParent = new PullFromUpstream(subexecutor.upstreamExecutor, subexecutor.createChild, subexecutor.lastDone !== undefined ? subexecutor.combineChildResults(subexecutor.lastDone, doneValue) : doneValue, subexecutor.activeChildExecutors, subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull, subexecutor.onEmit);
        this._closeLastSubstream = childExecutor.close(succeed3(doneValue));
        this.replaceSubexecutor(modifiedParent);
        break;
      }
      case OP_DRAIN_CHILD_EXECUTORS: {
        const modifiedParent = new DrainChildExecutors(subexecutor.upstreamExecutor, subexecutor.lastDone !== undefined ? subexecutor.combineChildResults(subexecutor.lastDone, doneValue) : doneValue, subexecutor.activeChildExecutors, subexecutor.upstreamDone, subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull);
        this._closeLastSubstream = childExecutor.close(succeed3(doneValue));
        this.replaceSubexecutor(modifiedParent);
        break;
      }
      default: {
        break;
      }
    }
  }
  handleSubexecutorFailure(childExecutor, parentSubexecutor, cause2) {
    return this.finishSubexecutorWithCloseEffect(failCause3(cause2), (exit3) => parentSubexecutor.close(exit3), (exit3) => childExecutor.close(exit3));
  }
  pullFromUpstream(subexecutor) {
    if (subexecutor.activeChildExecutors.length === 0) {
      return this.performPullFromUpstream(subexecutor);
    }
    const activeChild = subexecutor.activeChildExecutors[0];
    const parentSubexecutor = new PullFromUpstream(subexecutor.upstreamExecutor, subexecutor.createChild, subexecutor.lastDone, subexecutor.activeChildExecutors.slice(1), subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull, subexecutor.onEmit);
    if (activeChild === undefined) {
      return this.performPullFromUpstream(parentSubexecutor);
    }
    this.replaceSubexecutor(new PullFromChild(activeChild.childExecutor, parentSubexecutor, activeChild.onEmit));
    return;
  }
  performPullFromUpstream(subexecutor) {
    return Read(subexecutor.upstreamExecutor, (effect3) => {
      const closeLastSubstream = this._closeLastSubstream === undefined ? unit4 : this._closeLastSubstream;
      this._closeLastSubstream = undefined;
      return pipe(this._executeCloseLastSubstream(closeLastSubstream), zipRight3(effect3));
    }, (emitted) => {
      if (this._closeLastSubstream !== undefined) {
        const closeLastSubstream = this._closeLastSubstream;
        this._closeLastSubstream = undefined;
        return pipe(this._executeCloseLastSubstream(closeLastSubstream), map15(() => {
          const childExecutor2 = new ChannelExecutor(subexecutor.createChild(emitted), this._providedEnv, this._executeCloseLastSubstream);
          childExecutor2._input = this._input;
          const [emitSeparator2, updatedChildExecutors2] = this.applyUpstreamPullStrategy(false, subexecutor.activeChildExecutors, subexecutor.onPull(Pulled(emitted)));
          this._activeSubexecutor = new PullFromChild(childExecutor2, new PullFromUpstream(subexecutor.upstreamExecutor, subexecutor.createChild, subexecutor.lastDone, updatedChildExecutors2, subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull, subexecutor.onEmit), subexecutor.onEmit);
          if (isSome2(emitSeparator2)) {
            this._activeSubexecutor = new Emit2(emitSeparator2.value, this._activeSubexecutor);
          }
          return;
        }));
      }
      const childExecutor = new ChannelExecutor(subexecutor.createChild(emitted), this._providedEnv, this._executeCloseLastSubstream);
      childExecutor._input = this._input;
      const [emitSeparator, updatedChildExecutors] = this.applyUpstreamPullStrategy(false, subexecutor.activeChildExecutors, subexecutor.onPull(Pulled(emitted)));
      this._activeSubexecutor = new PullFromChild(childExecutor, new PullFromUpstream(subexecutor.upstreamExecutor, subexecutor.createChild, subexecutor.lastDone, updatedChildExecutors, subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull, subexecutor.onEmit), subexecutor.onEmit);
      if (isSome2(emitSeparator)) {
        this._activeSubexecutor = new Emit2(emitSeparator.value, this._activeSubexecutor);
      }
      return;
    }, (exit3) => {
      if (subexecutor.activeChildExecutors.some((subexecutor2) => subexecutor2 !== undefined)) {
        const drain = new DrainChildExecutors(subexecutor.upstreamExecutor, subexecutor.lastDone, [undefined, ...subexecutor.activeChildExecutors], subexecutor.upstreamExecutor.getDone(), subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull);
        if (this._closeLastSubstream !== undefined) {
          const closeLastSubstream2 = this._closeLastSubstream;
          this._closeLastSubstream = undefined;
          return pipe(this._executeCloseLastSubstream(closeLastSubstream2), map15(() => this.replaceSubexecutor(drain)));
        }
        this.replaceSubexecutor(drain);
        return;
      }
      const closeLastSubstream = this._closeLastSubstream;
      const state = this.finishSubexecutorWithCloseEffect(pipe(exit3, map10((a) => subexecutor.combineWithChildResult(subexecutor.lastDone, a))), () => closeLastSubstream, (exit4) => subexecutor.upstreamExecutor.close(exit4));
      return state === undefined ? undefined : effectOrUndefinedIgnored(state);
    });
  }
  drainChildExecutors(subexecutor) {
    if (subexecutor.activeChildExecutors.length === 0) {
      const lastClose = this._closeLastSubstream;
      if (lastClose !== undefined) {
        this.addFinalizer(() => succeed7(lastClose));
      }
      return this.finishSubexecutorWithCloseEffect(subexecutor.upstreamDone, () => lastClose, (exit3) => subexecutor.upstreamExecutor.close(exit3));
    }
    const activeChild = subexecutor.activeChildExecutors[0];
    const rest = subexecutor.activeChildExecutors.slice(1);
    if (activeChild === undefined) {
      const [emitSeparator, remainingExecutors] = this.applyUpstreamPullStrategy(true, rest, subexecutor.onPull(NoUpstream(rest.reduce((n, curr) => curr !== undefined ? n + 1 : n, 0))));
      this.replaceSubexecutor(new DrainChildExecutors(subexecutor.upstreamExecutor, subexecutor.lastDone, remainingExecutors, subexecutor.upstreamDone, subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull));
      if (isSome2(emitSeparator)) {
        this._emitted = emitSeparator.value;
        return Emit();
      }
      return;
    }
    const parentSubexecutor = new DrainChildExecutors(subexecutor.upstreamExecutor, subexecutor.lastDone, rest, subexecutor.upstreamDone, subexecutor.combineChildResults, subexecutor.combineWithChildResult, subexecutor.onPull);
    this.replaceSubexecutor(new PullFromChild(activeChild.childExecutor, parentSubexecutor, activeChild.onEmit));
    return;
  }
}
var ifNotNull = (effect3) => effect3 !== undefined ? effect3 : unit4;
var runFinalizers = (finalizers, exit3) => {
  return pipe(forEach7(finalizers, (fin) => exit2(fin(exit3))), map15((exits) => pipe(all2(exits), getOrElse(() => unit2))), flatMap8((exit4) => suspend3(() => exit4)));
};
var readUpstream = (r, onSuccess, onFailure) => {
  const readStack = [r];
  const read = () => {
    const current = readStack.pop();
    if (current === undefined || current.upstream === undefined) {
      return dieMessage2("Unexpected end of input for channel execution");
    }
    const state = current.upstream.run();
    switch (state._tag) {
      case OP_EMIT2: {
        const emitEffect = current.onEmit(current.upstream.getEmit());
        if (readStack.length === 0) {
          if (emitEffect === undefined) {
            return suspend3(onSuccess);
          }
          return pipe(emitEffect, matchCauseEffect2({
            onFailure,
            onSuccess
          }));
        }
        if (emitEffect === undefined) {
          return suspend3(() => read());
        }
        return pipe(emitEffect, matchCauseEffect2({
          onFailure,
          onSuccess: () => read()
        }));
      }
      case OP_DONE3: {
        const doneEffect = current.onDone(current.upstream.getDone());
        if (readStack.length === 0) {
          if (doneEffect === undefined) {
            return suspend3(onSuccess);
          }
          return pipe(doneEffect, matchCauseEffect2({
            onFailure,
            onSuccess
          }));
        }
        if (doneEffect === undefined) {
          return suspend3(() => read());
        }
        return pipe(doneEffect, matchCauseEffect2({
          onFailure,
          onSuccess: () => read()
        }));
      }
      case OP_FROM_EFFECT3: {
        readStack.push(current);
        return pipe(current.onEffect(state.effect), catchAllCause2((cause2) => suspend3(() => {
          const doneEffect = current.onDone(failCause3(cause2));
          return doneEffect === undefined ? unit4 : doneEffect;
        })), matchCauseEffect2({
          onFailure,
          onSuccess: () => read()
        }));
      }
      case OP_READ2: {
        readStack.push(current);
        readStack.push(state);
        return suspend3(() => read());
      }
    }
  };
  return read();
};
var run2 = (self) => pipe(runScoped(self), scoped);
var runScoped = (self) => {
  const run3 = (channelDeferred, scopeDeferred, scope4) => acquireUseRelease2(sync2(() => new ChannelExecutor(self, undefined, identity)), (exec) => suspend3(() => pipe(runScopedInterpret(exec.run(), exec), intoDeferred2(channelDeferred), zipRight3(_await(channelDeferred)), zipLeft2(_await(scopeDeferred)))), (exec, exit3) => {
    const finalize = exec.close(exit3);
    if (finalize === undefined) {
      return unit4;
    }
    return tapErrorCause2(finalize, (cause2) => addFinalizer2(scope4, failCause6(cause2)));
  });
  return uninterruptibleMask2((restore) => flatMap8(scope2, (parent) => pipe(all5([fork2(parent, sequential3), make23(), make23()]), flatMap8(([child, channelDeferred, scopeDeferred]) => pipe(forkScoped2(restore(run3(channelDeferred, scopeDeferred, child))), flatMap8((fiber) => pipe(addFinalizer3(() => succeed2(scopeDeferred, undefined)), zipRight3(restore(_await(channelDeferred))), zipLeft2(inheritAll2(fiber)))))))));
};
var runScopedInterpret = (channelState, exec) => {
  const op = channelState;
  switch (op._tag) {
    case OP_FROM_EFFECT3: {
      return pipe(op.effect, flatMap8(() => runScopedInterpret(exec.run(), exec)));
    }
    case OP_EMIT2: {
      return runScopedInterpret(exec.run(), exec);
    }
    case OP_DONE3: {
      return suspend3(() => exec.getDone());
    }
    case OP_READ2: {
      return readUpstream(op, () => runScopedInterpret(exec.run(), exec), failCause6);
    }
  }
};

// node_modules/effect/dist/esm/internal/opCodes/channelMergeDecision.js
var OP_DONE4 = "Done";
var OP_AWAIT = "Await";

// node_modules/effect/dist/esm/internal/channel/mergeDecision.js
var MergeDecisionSymbolKey = "effect/ChannelMergeDecision";
var MergeDecisionTypeId = /* @__PURE__ */ Symbol.for(MergeDecisionSymbolKey);
var proto9 = {
  [MergeDecisionTypeId]: {
    _R: (_) => _,
    _E0: (_) => _,
    _Z0: (_) => _,
    _E: (_) => _,
    _Z: (_) => _
  }
};
var Await = (f) => {
  const op = Object.create(proto9);
  op._tag = OP_AWAIT;
  op.f = f;
  return op;
};

// node_modules/effect/dist/esm/internal/opCodes/channelMergeState.js
var OP_BOTH_RUNNING = "BothRunning";
var OP_LEFT_DONE = "LeftDone";
var OP_RIGHT_DONE = "RightDone";

// node_modules/effect/dist/esm/internal/channel/mergeState.js
var MergeStateSymbolKey = "effect/ChannelMergeState";
var MergeStateTypeId = /* @__PURE__ */ Symbol.for(MergeStateSymbolKey);
var proto10 = {
  [MergeStateTypeId]: MergeStateTypeId
};
var BothRunning = (left3, right3) => {
  const op = Object.create(proto10);
  op._tag = OP_BOTH_RUNNING;
  op.left = left3;
  op.right = right3;
  return op;
};
var LeftDone = (f) => {
  const op = Object.create(proto10);
  op._tag = OP_LEFT_DONE;
  op.f = f;
  return op;
};
var RightDone = (f) => {
  const op = Object.create(proto10);
  op._tag = OP_RIGHT_DONE;
  op.f = f;
  return op;
};

// node_modules/effect/dist/esm/internal/opCodes/channelMergeStrategy.js
var OP_BACK_PRESSURE = "BackPressure";
var OP_BUFFER_SLIDING = "BufferSliding";

// node_modules/effect/dist/esm/internal/channel/mergeStrategy.js
var MergeStrategySymbolKey = "effect/ChannelMergeStrategy";
var MergeStrategyTypeId = /* @__PURE__ */ Symbol.for(MergeStrategySymbolKey);
var proto11 = {
  [MergeStrategyTypeId]: MergeStrategyTypeId
};
var BackPressure = (_) => {
  const op = Object.create(proto11);
  op._tag = OP_BACK_PRESSURE;
  return op;
};
var BufferSliding = (_) => {
  const op = Object.create(proto11);
  op._tag = OP_BUFFER_SLIDING;
  return op;
};
var match14 = /* @__PURE__ */ dual(2, (self, {
  onBackPressure,
  onBufferSliding
}) => {
  switch (self._tag) {
    case OP_BACK_PRESSURE: {
      return onBackPressure();
    }
    case OP_BUFFER_SLIDING: {
      return onBufferSliding();
    }
  }
});

// node_modules/effect/dist/esm/internal/channel/singleProducerAsyncInput.js
var OP_STATE_EMPTY = "Empty";
var OP_STATE_EMIT = "Emit";
var OP_STATE_ERROR = "Error";
var OP_STATE_DONE2 = "Done";
var stateEmpty = (notifyProducer) => ({
  _tag: OP_STATE_EMPTY,
  notifyProducer
});
var stateEmit = (notifyConsumers) => ({
  _tag: OP_STATE_EMIT,
  notifyConsumers
});
var stateError = (cause2) => ({
  _tag: OP_STATE_ERROR,
  cause: cause2
});
var stateDone = (done8) => ({
  _tag: OP_STATE_DONE2,
  done: done8
});

class SingleProducerAsyncInputImpl {
  ref;
  constructor(ref) {
    this.ref = ref;
  }
  awaitRead() {
    return flatten6(modify3(this.ref, (state) => state._tag === OP_STATE_EMPTY ? [_await(state.notifyProducer), state] : [unit4, state]));
  }
  get close() {
    return fiberIdWith2((fiberId2) => this.error(interrupt4(fiberId2)));
  }
  done(value) {
    return flatten6(modify3(this.ref, (state) => {
      switch (state._tag) {
        case OP_STATE_EMPTY: {
          return [_await(state.notifyProducer), state];
        }
        case OP_STATE_EMIT: {
          return [forEach7(state.notifyConsumers, (deferred) => succeed2(deferred, left2(value)), {
            discard: true
          }), stateDone(value)];
        }
        case OP_STATE_ERROR: {
          return [interrupt7, state];
        }
        case OP_STATE_DONE2: {
          return [interrupt7, state];
        }
      }
    }));
  }
  emit(element) {
    return flatMap8(make23(), (deferred) => flatten6(modify3(this.ref, (state) => {
      switch (state._tag) {
        case OP_STATE_EMPTY: {
          return [_await(state.notifyProducer), state];
        }
        case OP_STATE_EMIT: {
          const notifyConsumer = state.notifyConsumers[0];
          const notifyConsumers = state.notifyConsumers.slice(1);
          if (notifyConsumer !== undefined) {
            return [succeed2(notifyConsumer, right2(element)), notifyConsumers.length === 0 ? stateEmpty(deferred) : stateEmit(notifyConsumers)];
          }
          throw new Error("Bug: Channel.SingleProducerAsyncInput.emit - Queue was empty! please report an issue at https://github.com/Effect-TS/effect/issues");
        }
        case OP_STATE_ERROR: {
          return [interrupt7, state];
        }
        case OP_STATE_DONE2: {
          return [interrupt7, state];
        }
      }
    })));
  }
  error(cause2) {
    return flatten6(modify3(this.ref, (state) => {
      switch (state._tag) {
        case OP_STATE_EMPTY: {
          return [_await(state.notifyProducer), state];
        }
        case OP_STATE_EMIT: {
          return [forEach7(state.notifyConsumers, (deferred) => failCause2(deferred, cause2), {
            discard: true
          }), stateError(cause2)];
        }
        case OP_STATE_ERROR: {
          return [interrupt7, state];
        }
        case OP_STATE_DONE2: {
          return [interrupt7, state];
        }
      }
    }));
  }
  get take() {
    return this.takeWith((cause2) => failCause3(map11(cause2, left2)), (elem) => succeed3(elem), (done8) => fail3(right2(done8)));
  }
  takeWith(onError2, onElement, onDone) {
    return flatMap8(make23(), (deferred) => flatten6(modify3(this.ref, (state) => {
      switch (state._tag) {
        case OP_STATE_EMPTY: {
          return [zipRight3(succeed2(state.notifyProducer, undefined), matchCause2(_await(deferred), {
            onFailure: onError2,
            onSuccess: match2({
              onLeft: onDone,
              onRight: onElement
            })
          })), stateEmit([deferred])];
        }
        case OP_STATE_EMIT: {
          return [matchCause2(_await(deferred), {
            onFailure: onError2,
            onSuccess: match2({
              onLeft: onDone,
              onRight: onElement
            })
          }), stateEmit([...state.notifyConsumers, deferred])];
        }
        case OP_STATE_ERROR: {
          return [succeed7(onError2(state.cause)), state];
        }
        case OP_STATE_DONE2: {
          return [succeed7(onDone(state.done)), state];
        }
      }
    })));
  }
}
var make43 = () => pipe(make23(), flatMap8((deferred) => make25(stateEmpty(deferred))), map15((ref) => new SingleProducerAsyncInputImpl(ref)));

// node_modules/effect/dist/esm/internal/channel.js
var concatMap = /* @__PURE__ */ dual(2, (self, f) => concatMapWith(self, f, () => {
  return;
}, () => {
  return;
}));
var drain = (self) => {
  const drainer = readWithCause({
    onInput: () => drainer,
    onFailure: failCause8,
    onDone: succeed10
  });
  return pipeTo(self, drainer);
};
var ensuring4 = /* @__PURE__ */ dual(2, (self, finalizer) => ensuringWith(self, () => finalizer));
var flatten8 = (self) => flatMap10(self, identity);
var fromInput = (input) => unwrap(input.takeWith(failCause8, (elem) => flatMap10(write(elem), () => fromInput(input)), succeed10));
var identityChannel = () => readWith({
  onInput: (input) => flatMap10(write(input), () => identityChannel()),
  onFailure: fail9,
  onDone: succeedNow
});
var map17 = /* @__PURE__ */ dual(2, (self, f) => flatMap10(self, (a) => sync5(() => f(a))));
var mapOut = /* @__PURE__ */ dual(2, (self, f) => {
  const reader = readWith({
    onInput: (outElem) => flatMap10(write(f(outElem)), () => reader),
    onFailure: fail9,
    onDone: succeedNow
  });
  return pipeTo(self, reader);
});
var mapOutEffectPar = /* @__PURE__ */ dual(3, (self, f, n) => pipe(gen2(function* ($) {
  const queue = yield* $(acquireRelease2(bounded3(n), (queue2) => shutdown2(queue2)));
  const errorSignal = yield* $(make23());
  const withPermits = n === Number.POSITIVE_INFINITY ? (_) => identity : (yield* $(makeSemaphore2(n))).withPermits;
  const pull = yield* $(toPull(self));
  yield* $(matchCauseEffect2(pull, {
    onFailure: (cause2) => offer3(queue, failCause6(cause2)),
    onSuccess: (either5) => match2(either5, {
      onLeft: (outDone) => {
        const lock = withPermits(n);
        return zipRight3(interruptible3(lock(unit4)), asUnit2(offer3(queue, succeed7(left2(outDone)))));
      },
      onRight: (outElem) => gen2(function* ($2) {
        const deferred = yield* $2(make23());
        const latch = yield* $2(make23());
        yield* $2(asUnit2(offer3(queue, map15(_await(deferred), right2))));
        yield* $2(succeed2(latch, undefined), zipRight3(pipe(uninterruptibleMask2((restore) => pipe(exit2(restore(_await(errorSignal))), raceFirst2(exit2(restore(f(outElem)))), flatMap8((exit3) => suspend3(() => exit3)))), tapErrorCause2((cause2) => failCause2(errorSignal, cause2)), intoDeferred2(deferred))), withPermits(1), forkScoped2);
        yield* $2(_await(latch));
      })
    })
  }), forever3, interruptible3, forkScoped2);
  return queue;
}), map15((queue) => {
  const consumer = unwrap(matchCause2(flatten6(take3(queue)), {
    onFailure: failCause8,
    onSuccess: match2({
      onLeft: succeedNow,
      onRight: (outElem) => flatMap10(write(outElem), () => consumer)
    })
  }));
  return consumer;
}), unwrapScoped2));
var mergeAll4 = (options) => {
  return (channels) => mergeAllWith(options)(channels, constVoid);
};
var mergeAllWith = ({
  bufferSize = 16,
  concurrency,
  mergeStrategy = BackPressure()
}) => (channels, f) => pipe(gen2(function* ($) {
  const concurrencyN = concurrency === "unbounded" ? Number.MAX_SAFE_INTEGER : concurrency;
  const input = yield* $(make43());
  const queueReader = fromInput(input);
  const queue = yield* $(acquireRelease2(bounded3(bufferSize), (queue2) => shutdown2(queue2)));
  const cancelers = yield* $(acquireRelease2(unbounded3(), (queue2) => shutdown2(queue2)));
  const lastDone = yield* $(make25(none2()));
  const errorSignal = yield* $(make23());
  const withPermits = (yield* $(makeSemaphore2(concurrencyN))).withPermits;
  const pull = yield* $(toPull(channels));
  const evaluatePull = (pull2) => pipe(flatMap8(pull2, match2({
    onLeft: (done8) => succeed7(some2(done8)),
    onRight: (outElem) => as3(offer3(queue, succeed7(right2(outElem))), none2())
  })), repeat({
    until: (_) => isSome2(_)
  }), flatMap8((outDone) => update3(lastDone, match({
    onNone: () => some2(outDone.value),
    onSome: (lastDone2) => some2(f(lastDone2, outDone.value))
  }))), catchAllCause2((cause2) => isInterrupted2(cause2) ? failCause6(cause2) : pipe(offer3(queue, failCause6(cause2)), zipRight3(succeed2(errorSignal, undefined)), asUnit2)));
  yield* $(matchCauseEffect2(pull, {
    onFailure: (cause2) => pipe(offer3(queue, failCause6(cause2)), zipRight3(succeed7(false))),
    onSuccess: match2({
      onLeft: (outDone) => raceWith2(interruptible3(_await(errorSignal)), interruptible3(withPermits(concurrencyN)(unit4)), {
        onSelfDone: (_, permitAcquisition) => as3(interrupt5(permitAcquisition), false),
        onOtherDone: (_, failureAwait) => zipRight3(interrupt5(failureAwait), pipe(get10(lastDone), flatMap8(match({
          onNone: () => offer3(queue, succeed7(left2(outDone))),
          onSome: (lastDone2) => offer3(queue, succeed7(left2(f(lastDone2, outDone))))
        })), as3(false)))
      }),
      onRight: (channel) => match14(mergeStrategy, {
        onBackPressure: () => gen2(function* ($2) {
          const latch = yield* $2(make23());
          const raceEffects = pipe(queueReader, pipeTo(channel), toPull, flatMap8((pull2) => race2(evaluatePull(pull2), interruptible3(_await(errorSignal)))), scoped);
          yield* $2(succeed2(latch, undefined), zipRight3(raceEffects), withPermits(1), forkScoped2);
          yield* $2(_await(latch));
          const errored = yield* $2(isDone(errorSignal));
          return !errored;
        }),
        onBufferSliding: () => gen2(function* ($2) {
          const canceler = yield* $2(make23());
          const latch = yield* $2(make23());
          const size14 = yield* $2(size12(cancelers));
          yield* $2(take3(cancelers), flatMap8((_) => succeed2(_, undefined)), when2(() => size14 >= concurrencyN));
          yield* $2(offer3(cancelers, canceler));
          const raceEffects = pipe(queueReader, pipeTo(channel), toPull, flatMap8((pull2) => pipe(evaluatePull(pull2), race2(interruptible3(_await(errorSignal))), race2(interruptible3(_await(canceler))))), scoped);
          yield* $2(succeed2(latch, undefined), zipRight3(raceEffects), withPermits(1), forkScoped2);
          yield* $2(_await(latch));
          const errored = yield* $2(isDone(errorSignal));
          return !errored;
        })
      })
    })
  }), repeat({
    while: (_) => _
  }), forkScoped2);
  return [queue, input];
}), map15(([queue, input]) => {
  const consumer = pipe(take3(queue), flatten6, matchCause2({
    onFailure: failCause8,
    onSuccess: match2({
      onLeft: succeedNow,
      onRight: (outElem) => flatMap10(write(outElem), () => consumer)
    })
  }), unwrap);
  return embedInput(consumer, input);
}), unwrapScoped2);
var mergeMap = /* @__PURE__ */ dual(3, (self, f, options) => mergeAll4(options)(mapOut(self, f)));
var mergeWith = /* @__PURE__ */ dual(2, (self, options) => unwrapScoped2(flatMap8(make43(), (input) => {
  const queueReader = fromInput(input);
  return map15(zip5(toPull(pipeTo(queueReader, self)), toPull(pipeTo(queueReader, options.other))), ([pullL, pullR]) => {
    const handleSide = (exit3, fiber, pull) => (done8, both2, single2) => {
      const onDecision2 = (decision) => {
        const op = decision;
        if (op._tag === OP_DONE4) {
          return succeed7(fromEffect4(zipRight3(interrupt5(fiber), op.effect)));
        }
        return map15(_await3(fiber), match9({
          onFailure: (cause2) => fromEffect4(op.f(failCause3(cause2))),
          onSuccess: match2({
            onLeft: (done9) => fromEffect4(op.f(succeed3(done9))),
            onRight: (elem) => zipRight5(write(elem), go(single2(op.f)))
          })
        }));
      };
      return match9(exit3, {
        onFailure: (cause2) => onDecision2(done8(failCause3(cause2))),
        onSuccess: match2({
          onLeft: (z) => onDecision2(done8(succeed3(z))),
          onRight: (elem) => succeed7(flatMap10(write(elem), () => flatMap10(fromEffect4(forkDaemon2(pull)), (leftFiber) => go(both2(leftFiber, fiber)))))
        })
      });
    };
    const go = (state) => {
      switch (state._tag) {
        case OP_BOTH_RUNNING: {
          const leftJoin = interruptible3(join3(state.left));
          const rightJoin = interruptible3(join3(state.right));
          return unwrap(raceWith2(leftJoin, rightJoin, {
            onSelfDone: (leftExit, rf) => zipRight3(interrupt5(rf), handleSide(leftExit, state.right, pullL)(options.onSelfDone, BothRunning, (f) => LeftDone(f))),
            onOtherDone: (rightExit, lf) => zipRight3(interrupt5(lf), handleSide(rightExit, state.left, pullR)(options.onOtherDone, (left3, right3) => BothRunning(right3, left3), (f) => RightDone(f)))
          }));
        }
        case OP_LEFT_DONE: {
          return unwrap(map15(exit2(pullR), match9({
            onFailure: (cause2) => fromEffect4(state.f(failCause3(cause2))),
            onSuccess: match2({
              onLeft: (done8) => fromEffect4(state.f(succeed3(done8))),
              onRight: (elem) => flatMap10(write(elem), () => go(LeftDone(state.f)))
            })
          })));
        }
        case OP_RIGHT_DONE: {
          return unwrap(map15(exit2(pullL), match9({
            onFailure: (cause2) => fromEffect4(state.f(failCause3(cause2))),
            onSuccess: match2({
              onLeft: (done8) => fromEffect4(state.f(succeed3(done8))),
              onRight: (elem) => flatMap10(write(elem), () => go(RightDone(state.f)))
            })
          })));
        }
      }
    };
    return pipe(fromEffect4(zipWith5(forkDaemon2(pullL), forkDaemon2(pullR), (left3, right3) => BothRunning(left3, right3))), flatMap10(go), embedInput(input));
  });
})));
var pipeToOrFail = /* @__PURE__ */ dual(2, (self, that) => suspend4(() => {
  let channelException = undefined;
  const reader = readWith({
    onInput: (outElem) => flatMap10(write(outElem), () => reader),
    onFailure: (outErr) => {
      channelException = ChannelException(outErr);
      return failCause8(die4(channelException));
    },
    onDone: succeedNow
  });
  const writer = readWithCause({
    onInput: (outElem) => pipe(write(outElem), flatMap10(() => writer)),
    onFailure: (cause2) => isDieType2(cause2) && isChannelException(cause2.defect) && equals(cause2.defect, channelException) ? fail9(cause2.defect.error) : failCause8(cause2),
    onDone: succeedNow
  });
  return pipeTo(pipeTo(pipeTo(self, reader), that), writer);
}));
var runDrain = (self) => run2(drain(self));
var scoped3 = (effect3) => unwrap(uninterruptibleMask2((restore) => map15(make38(), (scope4) => acquireReleaseOut(tapErrorCause2(restore(extend2(effect3, scope4)), (cause2) => close(scope4, failCause3(cause2))), (_, exit3) => close(scope4, exit3)))));
var toPull = (self) => map15(acquireRelease2(sync2(() => new ChannelExecutor(self, undefined, identity)), (exec, exit3) => {
  const finalize = exec.close(exit3);
  return finalize === undefined ? unit4 : finalize;
}), (exec) => suspend3(() => interpretToPull(exec.run(), exec)));
var interpretToPull = (channelState, exec) => {
  const state = channelState;
  switch (state._tag) {
    case OP_DONE3: {
      return match9(exec.getDone(), {
        onFailure: failCause6,
        onSuccess: (done8) => succeed7(left2(done8))
      });
    }
    case OP_EMIT2: {
      return succeed7(right2(exec.getEmit()));
    }
    case OP_FROM_EFFECT3: {
      return pipe(state.effect, flatMap8(() => interpretToPull(exec.run(), exec)));
    }
    case OP_READ2: {
      return readUpstream(state, () => interpretToPull(exec.run(), exec), (cause2) => failCause6(cause2));
    }
  }
};
var unwrap = (channel) => flatten8(fromEffect4(channel));
var unwrapScoped2 = (self) => concatAllWith(scoped3(self), (d, _) => d, (d, _) => d);
var writeChunk = (outs) => writeChunkWriter(0, outs.length, outs);
var writeChunkWriter = (idx, len, chunk2) => {
  return idx === len ? unit5 : pipe(write(pipe(chunk2, unsafeGet4(idx))), flatMap10(() => writeChunkWriter(idx + 1, len, chunk2)));
};
var zip6 = /* @__PURE__ */ dual((args) => isChannel(args[1]), (self, that, options) => options?.concurrent ? mergeWith(self, {
  other: that,
  onSelfDone: (exit1) => Await((exit22) => suspend3(() => zip3(exit1, exit22))),
  onOtherDone: (exit22) => Await((exit1) => suspend3(() => zip3(exit1, exit22)))
}) : flatMap10(self, (a) => map17(that, (b) => [a, b])));
var zipRight5 = /* @__PURE__ */ dual((args) => isChannel(args[1]), (self, that, options) => options?.concurrent ? map17(zip6(self, that, {
  concurrent: true
}), (tuple3) => tuple3[1]) : flatMap10(self, () => that));
var ChannelExceptionTypeId = /* @__PURE__ */ Symbol.for("effect/Channel/ChannelException");
var ChannelException = (error) => ({
  _tag: "ChannelException",
  [ChannelExceptionTypeId]: ChannelExceptionTypeId,
  error
});
var isChannelException = (u) => hasProperty(u, ChannelExceptionTypeId);

// node_modules/effect/dist/esm/internal/sink.js
var SinkTypeId2 = /* @__PURE__ */ Symbol.for("effect/Sink");
var sinkVariance2 = {
  _A: (_) => _,
  _In: (_) => _,
  _L: (_) => _,
  _E: (_) => _,
  _R: (_) => _
};

class SinkImpl {
  channel;
  [SinkTypeId2] = sinkVariance2;
  constructor(channel) {
    this.channel = channel;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var drain2 = /* @__PURE__ */ new SinkImpl(/* @__PURE__ */ drain(/* @__PURE__ */ identityChannel()));
var fromEffect6 = (effect3) => new SinkImpl(fromEffect4(effect3));
var toChannel = (self) => isEffect2(self) ? toChannel(fromEffect6(self)) : self.channel;

// node_modules/effect/dist/esm/internal/take.js
var TakeSymbolKey = "effect/Take";
var TakeTypeId = /* @__PURE__ */ Symbol.for(TakeSymbolKey);
var takeVariance = {
  _A: (_) => _,
  _E: (_) => _
};

class TakeImpl {
  exit;
  [TakeTypeId] = takeVariance;
  constructor(exit3) {
    this.exit = exit3;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var chunk2 = (chunk3) => new TakeImpl(succeed3(chunk3));
var end3 = /* @__PURE__ */ new TakeImpl(/* @__PURE__ */ fail3(/* @__PURE__ */ none2()));
var failCause9 = (cause2) => new TakeImpl(failCause3(pipe(cause2, map11(some2))));
var of5 = (value) => new TakeImpl(succeed3(of2(value)));

// node_modules/effect/dist/esm/internal/stream/pull.js
var end4 = () => fail7(none2());
var failCause10 = (cause2) => mapError2(failCause6(cause2), some2);

// node_modules/effect/dist/esm/internal/stream.js
var StreamSymbolKey = "effect/Stream";
var StreamTypeId2 = /* @__PURE__ */ Symbol.for(StreamSymbolKey);
var streamVariance = {
  _R: (_) => _,
  _E: (_) => _,
  _A: (_) => _
};

class StreamImpl {
  channel;
  [StreamTypeId2] = streamVariance;
  constructor(channel) {
    this.channel = channel;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
var isStream = (u) => hasProperty(u, StreamTypeId2) || isEffect2(u);
var DefaultChunkSize = 4096;
var ensuring5 = /* @__PURE__ */ dual(2, (self, finalizer) => new StreamImpl(pipe(toChannel2(self), ensuring4(finalizer))));
var flatMap12 = /* @__PURE__ */ dual((args) => isStream(args[0]), (self, f, options) => {
  const bufferSize = options?.bufferSize ?? 16;
  if (options?.switch) {
    return matchConcurrency(options?.concurrency, () => flatMapParSwitchBuffer(self, 1, bufferSize, f), (n) => flatMapParSwitchBuffer(self, n, bufferSize, f));
  }
  return matchConcurrency(options?.concurrency, () => new StreamImpl(concatMap(toChannel2(self), (as6) => pipe(as6, map3((a) => toChannel2(f(a))), reduce2(unit5, (left3, right3) => pipe(left3, zipRight5(right3)))))), (_) => new StreamImpl(pipe(toChannel2(self), concatMap(writeChunk), mergeMap((out) => toChannel2(f(out)), options))));
});
var matchConcurrency = (concurrency, sequential4, bounded6) => {
  switch (concurrency) {
    case undefined:
      return sequential4();
    case "unbounded":
      return bounded6(Number.MAX_SAFE_INTEGER);
    default:
      return concurrency > 1 ? bounded6(concurrency) : sequential4();
  }
};
var flatMapParSwitchBuffer = /* @__PURE__ */ dual(4, (self, n, bufferSize, f) => new StreamImpl(pipe(toChannel2(self), concatMap(writeChunk), mergeMap((out) => toChannel2(f(out)), {
  concurrency: n,
  mergeStrategy: BufferSliding(),
  bufferSize
}))));
var flatten10 = /* @__PURE__ */ dual((args) => isStream(args[0]), (self, options) => flatMap12(self, identity, options));
var flattenChunks = (self) => {
  const flatten11 = readWithCause({
    onInput: (chunks) => flatMap10(writeChunk(chunks), () => flatten11),
    onFailure: failCause8,
    onDone: () => unit5
  });
  return new StreamImpl(pipe(toChannel2(self), pipeTo(flatten11)));
};
var flattenExitOption = (self) => {
  const processChunk = (chunk3, cont) => {
    const [toEmit, rest] = pipe(chunk3, splitWhere((exit3) => !isSuccess(exit3)));
    const next4 = pipe(head2(rest), match({
      onNone: () => cont,
      onSome: match9({
        onFailure: (cause2) => match(flipCauseOption2(cause2), {
          onNone: () => unit5,
          onSome: failCause8
        }),
        onSuccess: () => unit5
      })
    }));
    return pipe(write(pipe(toEmit, filterMap2((exit3) => isSuccess(exit3) ? some2(exit3.value) : none2()))), flatMap10(() => next4));
  };
  const process2 = readWithCause({
    onInput: (chunk3) => processChunk(chunk3, process2),
    onFailure: (cause2) => failCause8(cause2),
    onDone: () => unit5
  });
  return new StreamImpl(pipe(toChannel2(self), pipeTo(process2)));
};
var flattenTake = (self) => flattenChunks(flattenExitOption(pipe(self, map18((take5) => take5.exit))));
var toChannel2 = (stream) => {
  if ("channel" in stream) {
    return stream.channel;
  } else if (isEffect2(stream)) {
    return toChannel2(fromEffect7(stream));
  } else {
    throw new TypeError(`Expected a Stream.`);
  }
};
var fromEffect7 = (effect3) => pipe(effect3, mapError2(some2), fromEffectOption);
var fromEffectOption = (effect3) => new StreamImpl(unwrap(match12(effect3, {
  onFailure: match({
    onNone: () => unit5,
    onSome: fail9
  }),
  onSuccess: (a) => write(of2(a))
})));
var fromQueue = (queue, options) => pipe(takeBetween2(queue, 1, options?.maxChunkSize ?? DefaultChunkSize), catchAllCause2((cause2) => pipe(isShutdown2(queue), flatMap8((isShutdown4) => isShutdown4 && isInterrupted2(cause2) ? end4() : failCause10(cause2)))), repeatEffectChunkOption, options?.shutdown ? ensuring5(shutdown2(queue)) : identity);
var map18 = /* @__PURE__ */ dual(2, (self, f) => new StreamImpl(pipe(toChannel2(self), mapOut(map3(f)))));
var mapEffectSequential = /* @__PURE__ */ dual(2, (self, f) => {
  const loop2 = (iterator) => {
    const next4 = iterator.next();
    if (next4.done) {
      return readWithCause({
        onInput: (elem) => loop2(elem[Symbol.iterator]()),
        onFailure: failCause8,
        onDone: succeed10
      });
    } else {
      const value = next4.value;
      return unwrap(map15(f(value), (a2) => flatMap10(write(of2(a2)), () => loop2(iterator))));
    }
  };
  return new StreamImpl(pipe(toChannel2(self), pipeTo(suspend4(() => loop2(empty4()[Symbol.iterator]())))));
});
var mapEffectPar = /* @__PURE__ */ dual(3, (self, n, f) => new StreamImpl(pipe(toChannel2(self), concatMap(writeChunk), mapOutEffectPar(f, n), mapOut(of2))));
var repeatEffectChunkOption = (effect3) => unfoldChunkEffect(effect3, (effect4) => pipe(map15(effect4, (chunk3) => some2([chunk3, effect4])), catchAll2(match({
  onNone: () => succeed7(none2()),
  onSome: fail7
}))));
var run3 = /* @__PURE__ */ dual(2, (self, sink) => pipe(toChannel2(self), pipeToOrFail(toChannel(sink)), runDrain));
var runDrain2 = (self) => pipe(self, run3(drain2));
var scoped4 = (effect3) => new StreamImpl(ensuring4(scoped3(pipe(effect3, map15(of2))), unit4));
var suspend5 = (stream) => new StreamImpl(suspend4(() => toChannel2(stream())));
var unfoldChunkEffect = (s, f) => suspend5(() => {
  const loop2 = (s2) => unwrap(map15(f(s2), match({
    onNone: () => unit5,
    onSome: ([chunk3, s3]) => flatMap10(write(chunk3), () => loop2(s3))
  })));
  return new StreamImpl(loop2(s));
});
var unwrapScoped3 = (effect3) => flatten10(scoped4(effect3));

// node_modules/effect/dist/esm/internal/groupBy.js
var GroupBySymbolKey = "effect/GroupBy";
var GroupByTypeId = /* @__PURE__ */ Symbol.for(GroupBySymbolKey);
var groupByVariance = {
  _R: (_) => _,
  _E: (_) => _,
  _K: (_) => _,
  _V: (_) => _
};
var isGroupBy = (u) => hasProperty(u, GroupByTypeId);
var evaluate = /* @__PURE__ */ dual((args) => isGroupBy(args[0]), (self, f, options) => flatMap12(self.grouped, ([key, queue]) => f(key, flattenTake(fromQueue(queue, {
  shutdown: true
}))), {
  concurrency: "unbounded",
  bufferSize: options?.bufferSize ?? 16
}));
var make46 = (grouped) => ({
  [GroupByTypeId]: groupByVariance,
  pipe() {
    return pipeArguments(this, arguments);
  },
  grouped
});
var mapEffectOptions = /* @__PURE__ */ dual((args) => typeof args[0] !== "function", (self, f, options) => {
  if (options?.key) {
    return evaluate(groupByKey(self, options.key, {
      bufferSize: options.bufferSize
    }), (_, s) => mapEffectSequential(s, f));
  }
  return matchConcurrency(options?.concurrency, () => mapEffectSequential(self, f), (n) => options?.unordered ? flatMap12(self, (a) => fromEffect7(f(a)), {
    concurrency: n
  }) : mapEffectPar(self, n, f));
});
var groupByKey = /* @__PURE__ */ dual((args) => typeof args[0] !== "function", (self, f, options) => {
  const loop2 = (map19, outerQueue) => readWithCause({
    onInput: (input) => flatMap10(fromEffect4(forEach7(groupByIterable(input, f), ([key, values3]) => {
      const innerQueue = map19.get(key);
      if (innerQueue === undefined) {
        return pipe(bounded3(options?.bufferSize ?? 16), flatMap8((innerQueue2) => pipe(sync2(() => {
          map19.set(key, innerQueue2);
        }), zipRight3(offer3(outerQueue, of5([key, innerQueue2]))), zipRight3(pipe(offer3(innerQueue2, chunk2(values3)), catchSomeCause2((cause2) => isInterruptedOnly2(cause2) ? some2(unit4) : none2()))))));
      }
      return catchSomeCause2(offer3(innerQueue, chunk2(values3)), (cause2) => isInterruptedOnly2(cause2) ? some2(unit4) : none2());
    }, {
      discard: true
    })), () => loop2(map19, outerQueue)),
    onFailure: (cause2) => fromEffect4(offer3(outerQueue, failCause9(cause2))),
    onDone: () => pipe(fromEffect4(pipe(forEach7(map19.entries(), ([_, innerQueue]) => pipe(offer3(innerQueue, end3), catchSomeCause2((cause2) => isInterruptedOnly2(cause2) ? some2(unit4) : none2())), {
      discard: true
    }), zipRight3(offer3(outerQueue, end3)))))
  });
  return make46(unwrapScoped3(pipe(sync2(() => new Map), flatMap8((map19) => pipe(acquireRelease2(unbounded3(), (queue) => shutdown2(queue)), flatMap8((queue) => pipe(self, toChannel2, pipeTo(loop2(map19, queue)), drain, runScoped, forkScoped2, as3(flattenTake(fromQueue(queue, {
    shutdown: true
  }))))))))));
});
var groupByIterable = /* @__PURE__ */ dual(2, (iterable, f) => {
  const builder = [];
  const iterator = iterable[Symbol.iterator]();
  const map19 = new Map;
  let next4;
  while ((next4 = iterator.next()) && !next4.done) {
    const value = next4.value;
    const key = f(value);
    if (map19.has(key)) {
      const innerBuilder = map19.get(key);
      innerBuilder.push(value);
    } else {
      const innerBuilder = [value];
      builder.push([key, innerBuilder]);
      map19.set(key, innerBuilder);
    }
  }
  return unsafeFromArray(builder.map((tuple3) => [tuple3[0], unsafeFromArray(tuple3[1])]));
});

// node_modules/effect/dist/esm/Stream.js
var fromQueue2 = fromQueue;
var mapEffect4 = mapEffectOptions;
var runDrain3 = runDrain2;

// packages/framework/src/effect/core/event-effects.ts
var EventContext = GenericTag("EventContext");

class EventProcessingError extends TaggedError("EventProcessingError") {
}

class EventVersionConflict extends TaggedError("EventVersionConflict") {
}

class ProjectionError extends TaggedError("ProjectionError") {
}
class EventDispatcher {
  handlers = [];
  register(handler) {
    this.handlers.push(handler);
    return this;
  }
  dispatch(event) {
    const matchingHandlers = this.handlers.filter((h) => h.canHandle(event));
    if (matchingHandlers.length === 0) {
      return logWarning2(`No handlers for event type: ${event.type}`);
    }
    return all5(matchingHandlers.map((handler) => handler.handle(event)), { discard: true, concurrency: "unbounded" });
  }
  createProcessor(source) {
    return pipe(source, mapEffect4((event) => this.dispatch(event)), runDrain3, fork3);
  }
}
function createEventDispatcher() {
  return new EventDispatcher;
}

class EffectEventBus {
  queue = null;
  dispatcher = createEventDispatcher();
  processor = null;
  initialize() {
    return pipe(unbounded3(), tap2((q) => sync2(() => {
      this.queue = q;
    })), flatMap8((q) => pipe(fromQueue2(q), (stream) => this.dispatcher.createProcessor(stream), tap2((fiber) => sync2(() => {
      this.processor = fiber;
    })))), map15(() => {
      return;
    }));
  }
  publish(event) {
    if (!this.queue) {
      return fail7(new EventProcessingError({
        event,
        cause: new Error("Event bus not initialized")
      }));
    }
    return offer3(this.queue, event);
  }
  subscribe(handler) {
    return sync2(() => {
      this.dispatcher.register(handler);
    });
  }
  shutdown() {
    if (this.processor) {
      return interrupt5(this.processor);
    }
    return succeed7(undefined);
  }
}
var EventStoreServiceLive = succeed8(EventContext, EventContext.of({
  eventStore: {},
  projections: new Map
}));
// packages/framework/src/effect/core/repository-effects.ts
var RepositoryContextTag = () => GenericTag("RepositoryContext");

class AggregateNotFoundError2 extends TaggedError("AggregateNotFoundError") {
}

class VersionConflictError extends TaggedError("VersionConflictError") {
}

class PersistenceError extends TaggedError("PersistenceError") {
}

class SnapshotError extends TaggedError("SnapshotError") {
}
function createRepository(config2) {
  const contextTag = RepositoryContextTag();
  return {
    load: (id2) => gen2(function* (_) {
      const ctx = yield* _(contextTag);
      if (ctx.cache) {
        const cached3 = yield* _(ctx.cache.get(id2));
        if (isSome2(cached3)) {
          return cached3.value;
        }
      }
      const aggregate2 = yield* _(loadFromStore(ctx, id2, config2.createAggregate));
      if (ctx.cache) {
        yield* _(ctx.cache.set(id2, aggregate2));
      }
      return aggregate2;
    }),
    save: (aggregate2) => gen2(function* (_) {
      const ctx = yield* _(contextTag);
      yield* _(saveEvents(ctx, aggregate2));
      if (ctx.cache) {
        yield* _(ctx.cache.set(aggregate2.id, aggregate2));
      }
      if (config2.snapshotFrequency && aggregate2.version % config2.snapshotFrequency === 0) {
        yield* _(createSnapshot(ctx, aggregate2));
      }
    }),
    delete: (id2) => gen2(function* (_) {
      const ctx = yield* _(contextTag);
      yield* _(tryPromise2({
        try: () => ctx.eventStore.appendBatch([{
          aggregateId: id2,
          type: "AggregateDeleted",
          data: { deletedAt: new Date().toISOString() },
          version: 0,
          timestamp: new Date().toISOString()
        }]),
        catch: (error) => new PersistenceError({
          aggregateId: id2,
          operation: "delete",
          cause: error
        })
      }));
      if (ctx.cache) {
        yield* _(ctx.cache.invalidate(id2));
      }
    }),
    exists: (id2) => gen2(function* (_) {
      const ctx = yield* _(contextTag);
      const result = yield* _(tryPromise2({
        try: async () => {
          const events = await ctx.eventStore.getEvents(id2);
          return events.length > 0;
        },
        catch: () => false
      }));
      return result;
    }).pipe(mapError2(() => {
      return;
    }))
  };
}
function loadFromStore(ctx, id2, createAggregate) {
  return gen2(function* (_) {
    const snapshot = yield* _(loadSnapshot(ctx, id2));
    const events = yield* _(tryPromise2({
      try: () => ctx.eventStore.getEvents(id2, match(snapshot, {
        onNone: () => 0,
        onSome: (s) => s.version
      })),
      catch: (error) => new PersistenceError({
        aggregateId: id2,
        operation: "load",
        cause: error
      })
    }));
    if (events.length === 0 && isNone2(snapshot)) {
      return yield* _(fail7(new AggregateNotFoundError2({ aggregateId: id2 })));
    }
    const aggregate2 = createAggregate(id2);
    if (isSome2(snapshot)) {
      aggregate2.loadFromSnapshot(snapshot.value);
    }
    events.forEach((event) => aggregate2.applyEvent(event, false));
    return aggregate2;
  });
}
function saveEvents(ctx, aggregate2) {
  const uncommittedEvents = aggregate2.uncommittedEvents;
  if (!uncommittedEvents || uncommittedEvents.length === 0) {
    return succeed7(undefined);
  }
  return tryPromise2({
    try: () => ctx.eventStore.appendBatch(uncommittedEvents),
    catch: (error) => new PersistenceError({
      aggregateId: aggregate2.id,
      operation: "save",
      cause: error
    })
  }).pipe(tap2(() => sync2(() => aggregate2.markEventsAsCommitted())));
}
function loadSnapshot(ctx, id2) {
  if (!ctx.snapshotStore) {
    return succeed7(none2());
  }
  return sync2(() => {
    const snapshot = ctx.snapshotStore.get(id2);
    return snapshot ? some2(snapshot) : none2();
  });
}
function createSnapshot(ctx, aggregate2) {
  if (!ctx.snapshotStore) {
    return succeed7(undefined);
  }
  return sync2(() => {
    const snapshot = aggregate2.createSnapshot();
    ctx.snapshotStore.set(aggregate2.id, snapshot);
  });
}
function withOptimisticLocking(repository) {
  const versions = new Map;
  const contextTag = RepositoryContextTag();
  return {
    ...repository,
    save: (aggregate2) => gen2(function* (_) {
      const ctx = yield* _(contextTag);
      const events = yield* _(tryPromise2({
        try: () => ctx.eventStore.getEvents(aggregate2.id),
        catch: (error) => new PersistenceError({
          aggregateId: aggregate2.id,
          operation: "save",
          cause: error
        })
      }));
      const currentVersion = events.length;
      const lastKnownVersion = versions.get(aggregate2.id);
      if (lastKnownVersion && lastKnownVersion !== currentVersion) {
        return yield* _(fail7(new VersionConflictError({
          aggregateId: aggregate2.id,
          expectedVersion: lastKnownVersion,
          actualVersion: currentVersion
        })));
      }
      yield* _(repository.save(aggregate2));
      versions.set(aggregate2.id, aggregate2.version);
    })
  };
}
function withRetry(repository, schedule2 = exponential3(millis(100))) {
  return {
    load: (id2) => pipe(repository.load(id2), retry(schedule2)),
    save: (aggregate2) => pipe(repository.save(aggregate2), retry(schedule2)),
    delete: (id2) => pipe(repository.delete(id2), retry(schedule2)),
    exists: repository.exists
  };
}
// node_modules/effect/dist/esm/internal/secret.js
var SecretSymbolKey = "effect/Secret";
var SecretTypeId = /* @__PURE__ */ Symbol.for(SecretSymbolKey);
var proto12 = {
  [SecretTypeId]: SecretTypeId,
  [symbol]() {
    return pipe(hash(SecretSymbolKey), combine(array(this.raw)), cached(this));
  },
  [symbol2](that) {
    return isSecret(that) && this.raw.length === that.raw.length && this.raw.every((v, i) => equals(v, that.raw[i]));
  }
};
var isSecret = (u) => hasProperty(u, SecretTypeId);

// node_modules/effect/dist/esm/internal/config.js
var ConfigSymbolKey = "effect/Config";
var ConfigTypeId = /* @__PURE__ */ Symbol.for(ConfigSymbolKey);
var configVariance = {
  _A: (_) => _
};
var proto13 = {
  ...CommitPrototype,
  [ConfigTypeId]: configVariance,
  commit() {
    return config(this);
  }
};
var boolean3 = (name) => {
  const config2 = primitive("a boolean property", (text) => {
    switch (text) {
      case "true":
      case "yes":
      case "on":
      case "1": {
        return right2(true);
      }
      case "false":
      case "no":
      case "off":
      case "0": {
        return right2(false);
      }
      default: {
        const error = InvalidData([], `Expected a boolean value but received ${text}`);
        return left2(error);
      }
    }
  });
  return name === undefined ? config2 : nested2(config2, name);
};
var number4 = (name) => {
  const config2 = primitive("a number property", (text) => {
    const result = Number.parseFloat(text);
    if (Number.isNaN(result)) {
      return left2(InvalidData([], `Expected a number value but received ${text}`));
    }
    return right2(result);
  });
  return name === undefined ? config2 : nested2(config2, name);
};
var duration2 = (name) => {
  const config2 = mapOrFail(string4(), (value) => {
    const duration3 = decodeUnknown(value);
    return fromOption2(duration3, () => InvalidData([], `Expected a duration but received ${value}`));
  });
  return name === undefined ? config2 : nested2(config2, name);
};
var map19 = /* @__PURE__ */ dual(2, (self, f) => mapOrFail(self, (a) => right2(f(a))));
var mapOrFail = /* @__PURE__ */ dual(2, (self, f) => {
  const mapOrFail2 = Object.create(proto13);
  mapOrFail2._tag = OP_MAP_OR_FAIL;
  mapOrFail2.original = self;
  mapOrFail2.mapOrFail = f;
  return mapOrFail2;
});
var nested2 = /* @__PURE__ */ dual(2, (self, name) => {
  const nested3 = Object.create(proto13);
  nested3._tag = OP_NESTED;
  nested3.name = name;
  nested3.config = self;
  return nested3;
});
var primitive = (description, parse2) => {
  const primitive2 = Object.create(proto13);
  primitive2._tag = OP_PRIMITIVE;
  primitive2.description = description;
  primitive2.parse = parse2;
  return primitive2;
};
var string4 = (name) => {
  const config2 = primitive("a text property", right2);
  return name === undefined ? config2 : nested2(config2, name);
};

// node_modules/effect/dist/esm/Config.js
var boolean4 = boolean3;
var number5 = number4;
var duration3 = duration2;
var map20 = map19;
var string5 = string4;

// packages/framework/src/effect/services/index.ts
var EventStoreService = GenericTag("EventStoreService");
var CommandBusService = GenericTag("CommandBusService");
var QueryBusService = GenericTag("QueryBusService");
var ProjectionService = GenericTag("ProjectionService");
var NotificationService = GenericTag("NotificationService");
var LoggerService = GenericTag("LoggerService");
var MetricsService = GenericTag("MetricsService");
var CacheService = GenericTag("CacheService");
var ConfigurationService = GenericTag("ConfigurationService");
var LoggerServiceLive = succeed8(LoggerService, LoggerService.of({
  debug: (message, context6) => sync2(() => console.debug(message, context6)),
  info: (message, context6) => sync2(() => console.info(message, context6)),
  warn: (message, context6) => sync2(() => console.warn(message, context6)),
  error: (message, error, context6) => sync2(() => console.error(message, error, context6))
}));
var MetricsServiceLive = succeed8(MetricsService, MetricsService.of({
  increment: (name, value = 1, tags) => sync2(() => console.log(`Metric increment: ${name}`, { value, tags })),
  gauge: (name, value, tags) => sync2(() => console.log(`Metric gauge: ${name}`, { value, tags })),
  histogram: (name, value, tags) => sync2(() => console.log(`Metric histogram: ${name}`, { value, tags })),
  timer: (name, effect3, tags) => pipe(sync2(() => Date.now()), flatMap8((start3) => pipe(effect3, tap2(() => sync2(() => {
    const duration4 = Date.now() - start3;
    console.log(`Metric timer: ${name}`, { duration: duration4, tags });
  })))))
}));
var CacheServiceLive = effect(CacheService, sync2(() => {
  const cache = new Map;
  return CacheService.of({
    get: (key) => sync2(() => {
      const entry = cache.get(key);
      if (!entry)
        return null;
      if (entry.expiry && entry.expiry < Date.now()) {
        cache.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: (key, value, ttl) => sync2(() => {
      const expiry = ttl ? Date.now() + toMillis(ttl) : undefined;
      cache.set(key, { value, expiry });
    }),
    delete: (key) => sync2(() => {
      cache.delete(key);
    }),
    clear: () => sync2(() => {
      cache.clear();
    })
  });
}));
var ConfigurationServiceLive = succeed8(ConfigurationService, ConfigurationService.of({
  get: (key) => string5(key).pipe(map20((value) => JSON.parse(value)), mapError2((error) => new Error(`Config error for ${key}: ${error}`))),
  getString: (key) => string5(key).pipe(mapError2((error) => new Error(`Config error for ${key}: ${error}`))),
  getNumber: (key) => number5(key).pipe(mapError2((error) => new Error(`Config error for ${key}: ${error}`))),
  getBoolean: (key) => boolean4(key).pipe(mapError2((error) => new Error(`Config error for ${key}: ${error}`))),
  getDuration: (key) => duration3(key).pipe(mapError2((error) => new Error(`Config error for ${key}: ${error}`)))
}));
var CoreServicesLive = mergeAll3(LoggerServiceLive, MetricsServiceLive, CacheServiceLive, ConfigurationServiceLive);
// packages/framework/src/effect/patterns/retry.ts
class RetryExhaustedError extends TaggedError("RetryExhaustedError") {
}
// packages/framework/src/effect/patterns/circuit-breaker.ts
class CircuitOpenError extends TaggedError("CircuitOpenError") {
}
// packages/framework/src/effect/errors.ts
class EffectError extends TaggedError("EffectError") {
}

class CommandError extends TaggedError("CommandError") {
}

class EventError extends TaggedError("EventError") {
}

class RepositoryError extends TaggedError("RepositoryError") {
}

class ValidationError extends TaggedError("ValidationError") {
}

class TimeoutError extends TaggedError("TimeoutError") {
}

class CircuitBreakerError extends TaggedError("CircuitBreakerError") {
}

class RetryExhaustedError2 extends TaggedError("RetryExhaustedError") {
}

class ConnectionError extends TaggedError("ConnectionError") {
}

class AuthenticationError extends TaggedError("AuthenticationError") {
}

class AuthorizationError extends TaggedError("AuthorizationError") {
}

class NotFoundError extends TaggedError("NotFoundError") {
}

class ConflictError extends TaggedError("ConflictError") {
}

class RateLimitError extends TaggedError("RateLimitError") {
}
// node_modules/effect/dist/esm/internal/stm/opCodes/tExit.js
var OP_RETRY = "Retry";

// node_modules/effect/dist/esm/internal/stm/opCodes/stmState.js
var OP_INTERRUPTED = "Interrupted";
var OP_RUNNING2 = "Running";

// node_modules/effect/dist/esm/internal/stm/stm/stmState.js
var STMStateSymbolKey = "effect/STM/State";
var STMStateTypeId = /* @__PURE__ */ Symbol.for(STMStateSymbolKey);
var isSTMState = (u) => hasProperty(u, STMStateTypeId);
var interruptedHash = /* @__PURE__ */ pipe(/* @__PURE__ */ hash(STMStateSymbolKey), /* @__PURE__ */ combine(/* @__PURE__ */ hash(OP_INTERRUPTED)), /* @__PURE__ */ combine(/* @__PURE__ */ hash("interrupted")));
var interrupted2 = {
  [STMStateTypeId]: STMStateTypeId,
  _tag: OP_INTERRUPTED,
  [symbol]() {
    return interruptedHash;
  },
  [symbol2](that) {
    return isSTMState(that) && that._tag === OP_INTERRUPTED;
  }
};
var runningHash = /* @__PURE__ */ pipe(/* @__PURE__ */ hash(STMStateSymbolKey), /* @__PURE__ */ combine(/* @__PURE__ */ hash(OP_RUNNING2)), /* @__PURE__ */ combine(/* @__PURE__ */ hash("running")));
var running3 = {
  [STMStateTypeId]: STMStateTypeId,
  _tag: OP_RUNNING2,
  [symbol]() {
    return runningHash;
  },
  [symbol2](that) {
    return isSTMState(that) && that._tag === OP_RUNNING2;
  }
};

// node_modules/effect/dist/esm/internal/stm/stm/tExit.js
var TExitSymbolKey = "effect/TExit";
var TExitTypeId = /* @__PURE__ */ Symbol.for(TExitSymbolKey);
var variance8 = {
  _A: (_) => _,
  _E: (_) => _
};
var isExit = (u) => hasProperty(u, TExitTypeId);
var isRetry = (self) => {
  return self._tag === OP_RETRY;
};
var retryHash = /* @__PURE__ */ pipe(/* @__PURE__ */ hash(TExitSymbolKey), /* @__PURE__ */ combine(/* @__PURE__ */ hash(OP_RETRY)), /* @__PURE__ */ combine(/* @__PURE__ */ hash("retry")));
var retry4 = {
  [TExitTypeId]: variance8,
  _tag: OP_RETRY,
  [symbol]() {
    return retryHash;
  },
  [symbol2](that) {
    return isExit(that) && isRetry(that);
  }
};
// packages/framework/src/core/branded/factories.ts
var BrandedTypes = {
  aggregateId: (id2) => {
    if (!id2 || typeof id2 !== "string") {
      throw new Error("Invalid aggregate ID");
    }
    return id2;
  },
  eventId: (id2) => {
    if (!id2 || typeof id2 !== "string") {
      throw new Error("Invalid event ID");
    }
    return id2;
  },
  commandId: (id2) => {
    if (!id2 || typeof id2 !== "string") {
      throw new Error("Invalid command ID");
    }
    return id2;
  },
  correlationId: (id2) => {
    if (!id2 || typeof id2 !== "string") {
      throw new Error("Invalid correlation ID");
    }
    return id2;
  },
  causationId: (id2) => {
    if (!id2 || typeof id2 !== "string") {
      throw new Error("Invalid causation ID");
    }
    return id2;
  },
  eventVersion: (version) => {
    if (typeof version !== "number" || version < 0) {
      throw new Error("Invalid event version");
    }
    return version;
  },
  aggregateVersion: (version) => {
    if (typeof version !== "number" || version < 0) {
      throw new Error("Invalid aggregate version");
    }
    return version;
  },
  timestamp: (date2 = new Date) => {
    if (!(date2 instanceof Date) || isNaN(date2.getTime())) {
      throw new Error("Invalid timestamp");
    }
    return date2.toISOString();
  }
};
var aggregateId = BrandedTypes.aggregateId;
var eventId = BrandedTypes.eventId;
var commandId = BrandedTypes.commandId;
var correlationId = BrandedTypes.correlationId;
var causationId = BrandedTypes.causationId;
var eventVersion = BrandedTypes.eventVersion;
var aggregateVersion = BrandedTypes.aggregateVersion;
var timestamp = BrandedTypes.timestamp;
// src/examples/product-domain-demo.ts
var { aggregateId: aggregateId2, eventversion: AggregateVersion2, aggregateVersion: aggregateVersion2, timestamp: timestamp2 } = BrandedTypes;

class ProductNotFoundError extends TaggedError("ProductNotFoundError") {
}

class InsufficientStockError extends TaggedError("InsufficientStockError") {
}

class InvalidPriceError extends TaggedError("InvalidPriceError") {
}

class DuplicateSkuError extends TaggedError("DuplicateSkuError") {
}
class ProductAggregate {
  id;
  _state = null;
  _version = 0;
  _uncommittedEvents = [];
  constructor(id2) {
    this.id = id2;
  }
  get state() {
    if (!this._state) {
      throw new Error("Product not initialized");
    }
    return this._state;
  }
  get version() {
    return aggregateVersion2(this._version);
  }
  get uncommittedEvents() {
    return this._uncommittedEvents;
  }
  create(data) {
    if (data.price <= 0) {
      return fail7(new InvalidPriceError({ price: data.price }));
    }
    const event = {
      type: "PRODUCT_CREATED" /* PRODUCT_CREATED */,
      aggregateId: this.id,
      version: AggregateVersion2(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        name: data.name,
        sku: data.sku,
        price: data.price,
        quantity: data.initialStock,
        category: data.category
      }
    };
    this.applyEvent(event, true);
    return succeed7(undefined);
  }
  addStock(quantity, reason) {
    const event = {
      type: "STOCK_ADDED" /* STOCK_ADDED */,
      aggregateId: this.id,
      version: AggregateVersion2(this._version + 1),
      timestamp: new Date().toISOString(),
      data: { quantity, reason }
    };
    this.applyEvent(event, true);
    return succeed7(undefined);
  }
  removeStock(quantity, reason) {
    if (this.state.quantity < quantity) {
      return fail7(new InsufficientStockError({
        productId: this.id,
        requested: quantity,
        available: this.state.quantity
      }));
    }
    const event = {
      type: "STOCK_REMOVED" /* STOCK_REMOVED */,
      aggregateId: this.id,
      version: AggregateVersion2(this._version + 1),
      timestamp: new Date().toISOString(),
      data: { quantity, reason }
    };
    this.applyEvent(event, true);
    return succeed7(undefined);
  }
  changePrice(newPrice) {
    if (newPrice <= 0) {
      return fail7(new InvalidPriceError({ price: newPrice }));
    }
    const event = {
      type: "PRICE_CHANGED" /* PRICE_CHANGED */,
      aggregateId: this.id,
      version: AggregateVersion2(this._version + 1),
      timestamp: new Date().toISOString(),
      data: {
        oldPrice: this.state.price,
        newPrice
      }
    };
    this.applyEvent(event, true);
    return succeed7(undefined);
  }
  applyEvent(event, isNew) {
    switch (event.type) {
      case "PRODUCT_CREATED" /* PRODUCT_CREATED */:
        this._state = struct2({
          id: this.id,
          name: event.data.name,
          sku: event.data.sku,
          price: event.data.price,
          quantity: event.data.quantity,
          category: event.data.category,
          isActive: true,
          createdAt: event.timestamp,
          updatedAt: event.timestamp
        });
        break;
      case "STOCK_ADDED" /* STOCK_ADDED */:
        if (this._state) {
          this._state = struct2({
            ...this._state,
            quantity: this._state.quantity + event.data.quantity,
            updatedAt: event.timestamp
          });
        }
        break;
      case "STOCK_REMOVED" /* STOCK_REMOVED */:
        if (this._state) {
          this._state = struct2({
            ...this._state,
            quantity: this._state.quantity - event.data.quantity,
            updatedAt: event.timestamp
          });
        }
        break;
      case "PRICE_CHANGED" /* PRICE_CHANGED */:
        if (this._state) {
          this._state = struct2({
            ...this._state,
            price: event.data.newPrice,
            updatedAt: event.timestamp
          });
        }
        break;
    }
    this._version++;
    if (isNew) {
      this._uncommittedEvents.push(event);
    }
  }
  markEventsAsCommitted() {
    this._uncommittedEvents = [];
  }
}
var SkuServiceTag = GenericTag("SkuService");
var createProductHandler = createCommandHandler({
  canHandle: (cmd) => cmd.type === "CREATE_PRODUCT" /* CREATE_PRODUCT */,
  validate: (command) => gen2(function* () {
    const skuService = yield* SkuServiceTag;
    const exists3 = yield* skuService.checkSkuExists(command.payload.sku);
    if (exists3) {
      yield* fail7(new CommandValidationError({
        command,
        errors: [`SKU ${command.payload.sku} already exists`]
      }));
    }
  }),
  execute: (command) => gen2(function* () {
    const repository = yield* ProductRepositoryTag;
    const productId = aggregateId2(`product-${Date.now()}`);
    const aggregate2 = new ProductAggregate(productId);
    yield* aggregate2.create(command.payload);
    yield* repository.save(aggregate2);
    return { productId };
  })
});
var addStockHandler = createCommandHandler({
  canHandle: (cmd) => cmd.type === "ADD_STOCK" /* ADD_STOCK */,
  execute: (command) => gen2(function* () {
    const repository = yield* ProductRepositoryTag;
    const aggregate2 = yield* repository.load(command.aggregateId);
    yield* aggregate2.addStock(command.payload.quantity, command.payload.reason);
    yield* repository.save(aggregate2);
  })
});
var removeStockHandler = createCommandHandler({
  canHandle: (cmd) => cmd.type === "REMOVE_STOCK" /* REMOVE_STOCK */,
  execute: (command) => gen2(function* () {
    const repository = yield* ProductRepositoryTag;
    const aggregate2 = yield* repository.load(command.aggregateId);
    yield* aggregate2.removeStock(command.payload.quantity, command.payload.reason);
    yield* repository.save(aggregate2);
  })
});
var ProductRepositoryTag = GenericTag("ProductRepository");
var createProductRepository = () => withRetry(withOptimisticLocking(createRepository({
  createAggregate: (id2) => new ProductAggregate(id2),
  snapshotFrequency: 10,
  cacheCapacity: 100,
  cacheTTL: minutes(5)
})));
var SkuServiceLive = succeed8(SkuServiceTag, {
  checkSkuExists: (sku) => {
    const existingSkus = new Set(["PROD-001", "PROD-002"]);
    return succeed7(existingSkus.has(sku));
  }
});
var mockEventStore = {
  events: [],
  getEvents: async (aggregateId3, fromVersion) => {
    return mockEventStore.events.filter((e) => e.aggregateId === aggregateId3);
  },
  appendBatch: async (events) => {
    mockEventStore.events.push(...events);
  },
  getAllEvents: async () => mockEventStore.events,
  subscribe: () => {}
};
var RepositoryContextLive = succeed8(RepositoryContextTag(), {
  eventStore: mockEventStore,
  snapshotStore: new Map
});
var ProductRepositoryLive = effect(ProductRepositoryTag, succeed7(createProductRepository()));
var CommandContextLive = succeed8(CommandContext, {
  eventStore: mockEventStore,
  commandBus: { send: async () => {} }
});
var ProductDomainLive = mergeAll3(SkuServiceLive, RepositoryContextLive, ProductRepositoryLive, CommandContextLive);
var runDemo = gen2(function* () {
  console.log(`\uD83D\uDE80 Product Domain Demo with Effect-TS
`);
  console.log("1. Creating a new product...");
  const createCommand = {
    type: "CREATE_PRODUCT" /* CREATE_PRODUCT */,
    aggregateId: aggregateId2("temp"),
    payload: {
      name: "MacBook Pro M3",
      sku: "MBP-M3-2024",
      price: 2499.99,
      initialStock: 50,
      category: "Electronics"
    }
  };
  const { productId } = yield* createProductHandler.handle(createCommand);
  console.log(`   ✅ Product created with ID: ${productId}
`);
  console.log("2. Adding stock to the product...");
  const addStockCommand = {
    type: "ADD_STOCK" /* ADD_STOCK */,
    aggregateId: aggregateId2(productId),
    payload: {
      quantity: 25,
      reason: "New shipment received"
    }
  };
  yield* addStockHandler.handle(addStockCommand);
  console.log(`   ✅ Stock added successfully
`);
  console.log("3. Processing a sale (removing stock)...");
  const removeStockCommand = {
    type: "REMOVE_STOCK" /* REMOVE_STOCK */,
    aggregateId: aggregateId2(productId),
    payload: {
      quantity: 5,
      reason: "Customer purchase - Order #12345"
    }
  };
  yield* removeStockHandler.handle(removeStockCommand);
  console.log(`   ✅ Sale processed successfully
`);
  console.log("4. Testing error handling (insufficient stock)...");
  const invalidRemoveCommand = {
    type: "REMOVE_STOCK" /* REMOVE_STOCK */,
    aggregateId: aggregateId2(productId),
    payload: {
      quantity: 1000,
      reason: "Large order"
    }
  };
  const result = yield* pipe(removeStockHandler.handle(invalidRemoveCommand), either3);
  if (isLeft2(result)) {
    console.log("   ⚠️  Error caught: Insufficient stock");
    console.log(`      - Requested: 1000 units`);
    console.log(`      - Available: 70 units
`);
  }
  console.log("✨ Demo completed successfully!");
});
pipe(runDemo, provide(ProductDomainLive), runPromise).then(() => console.log(`
\uD83C\uDF89 All operations completed!`), (error) => console.error("❌ Error:", error));
export {
  removeStockHandler,
  createProductHandler,
  addStockHandler,
  ProductDomainLive,
  ProductAggregate
};
