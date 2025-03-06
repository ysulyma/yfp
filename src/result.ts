type PromiseValue<A> = A extends Promise<infer T> ? T : A;

type ResultMethods<T, E> = {
  map<S>(f: (value: T) => S): Result<S, E>;
  mapErr<F>(f: (error: E) => F): Result<T, F>;
  match<T2, E2>(arms: {Ok: (value: T) => T2; Err: (error: E) => E2}): T2 | E2;

  unwrapOr<A>(altValue: A): A | T;
  unwrapOrElse<A>(altGetter: (err: E) => A): A | T;
  unwrapOrThrow(): T;

  json(): SerializedResult<T, E>;
};

type ResultResultMethods<T, F> = T extends ResultMethods<infer V, infer E>
  ? {flatten: () => Result<V, E | F>}
  : unknown;

export type Result<T, E> = ResultMethods<T, E> &
  ResultResultMethods<T, E> &
  (
    | {
        isOk: false;
        isErr: true;
        unwrapErr(): E;
      }
    | {
        isOk: true;
        isErr: false;
        unwrap(): T;
      }
  );

// implementation
class internalResult<T, E> {
  private isOk: boolean;
  private value: T | undefined;
  private error: E | undefined;

  constructor(isOk: boolean, value: T | undefined, error: E | undefined) {
    this.isOk = isOk;
    if (isOk) {
      this.value = value;
    } else {
      this.error = error;
    }
  }

  get isErr() {
    return !this.isOk;
  }

  flatten() {
    if (this.isErr) return this;
    if (!isResult(this.value)) {
      throw new Error("Called flatten() on non-Result<Result<_>>");
    }

    return this.value;
  }

  map<S>(f: (value: T) => S): Result<S, E> {
    if (this.isOk) {
      return Ok(f(this.value as T));
    }
    return this as Result<S, E>;
  }

  mapErr<F>(f: (error: E) => F): Result<T, F> {
    if (this.isErr) {
      return Err(f(this.error as E));
    }
    return this as Result<T, F>;
  }

  match<T2, E2>(arms: {
    Ok: (value: T) => T2;
    Err: (error: E) => E2;
  }): T2 | E2 {
    if (this.isOk) {
      return arms.Ok(this.value as T);
    } else {
      return arms.Err(this.error as E);
    }
  }

  unwrap() {
    if (this.isOk) {
      return this.value as T;
    }
    throw new Error("Tried to unwrap Err");
  }

  unwrapErr() {
    if (this.isErr) {
      return this.error as E;
    }
    throw new Error("Tried to unwrapErr Ok");
  }

  unwrapOr<A>(altValue: A) {
    if (this.isOk) {
      return this.value as T;
    }
    return altValue;
  }

  unwrapOrElse<A>(altGetter: (err: E) => A) {
    if (this.isOk) {
      return this.value as T;
    }
    return altGetter(this.error as E);
  }

  unwrapOrThrow() {
    if (this.isOk) {
      return this.value as T;
    }
    throw this.error;
  }

  json(): SerializedResult<T, E> {
    if (this.isOk) {
      return {"#ok": this.value as T};
    }
    return {"#err": this.error as E};
  }
}

/** Internal helper for checking if an object is a Result */
function isResult<T, E>(obj: unknown): obj is Result<T, E> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "isOk" in obj &&
    typeof obj.isOk === "boolean"
  );
}

// biome-ignore lint/suspicious/noExplicitAny:
export function Ok<T>(value: T): Result<T, any> {
  const obj = new internalResult(true, value, undefined);
  Object.freeze(obj);
  return obj as unknown as Result<T, never>;
}

// biome-ignore lint/suspicious/noExplicitAny:
export function Err<E>(error: E): Result<any, E> {
  const obj = new internalResult(false, undefined, error);
  Object.freeze(obj);
  return obj as unknown as Result<never, E>;
}

// biome-ignore lint/style/noNamespace:
export namespace Result {
  /** Convert an array of Results to a single Result */
  export function all<T, E>(results: Result<T, E>[]): Result<T[], E[]> {
    const errors: E[] = [];
    const values: T[] = [];

    for (const result of results) {
      if (result.isErr) {
        errors.push(result.unwrapErr());
      } else {
        values.push(result.unwrap());
      }
    }

    if (errors.length === 0) {
      return Ok(values);
    }

    return Err(errors);
  }

  /** Deserialize a Result. */
  export const parse = <T, E>(ser: SerializedResult<T, E>): Result<T, E> => {
    if ("#ok" in ser) {
      return Ok(ser["#ok"]);
    }
    return Err(ser["#err"]);
  };

  /** Throw the error from this Result. */
  export function throwErr<T, E>(
    result: Result<T, E>,
  ): asserts result is Extract<Result<T, E>, {isOk: true}> {
    if (result.isErr) {
      throw result.unwrapErr();
    }
  }

  /** Wrap a function to return a Result instead of throwing. */
  export function wrap<E, F extends (...args: any[]) => any>(
    fn: F,
  ): (...args: Parameters<F>) => Result<ReturnType<F>, E> {
    return (...args: Parameters<F>) => {
      try {
        return Ok(fn(...args));
      } catch (error) {
        return Err(error as E);
      }
    };
  }

  /**
   * Wrap a Promise-returning function to return a Result instead of throwing.
   * @todo this may not work when there's an error before the first await in the function
   */
  export function wrapAsync<E, F extends (...args: any[]) => Promise<any>>(
    fn: F,
  ): (
    ...args: Parameters<F>
  ) => Promise<Result<PromiseValue<ReturnType<F>>, E>> {
    return (...args: Parameters<F>) => wrapPromise(fn(...args));
  }

  /** Wrap a Promise to return a Result instead of throwing. */
  export async function wrapPromise<T, E>(
    promise: Promise<T>,
  ): Promise<Result<T, E>> {
    try {
      return Ok(await promise);
    } catch (error) {
      return Err(error as E);
    }
  }
}

export type SerializedResult<T, E> = {"#err": E} | {"#ok": T};
