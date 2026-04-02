/* ════════════════════════════════════════════════════════════════
 *  React River — AsyncValue<T>
 *  Three-state wrapper for asynchronous operations.
 * ════════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────

export type AsyncValue<T> = AsyncLoading<T> | AsyncData<T> | AsyncError<T>

export interface AsyncLoading<T> {
	readonly status: "loading"
	/** Previous data, if available (e.g. during refresh) */
	readonly data: T | undefined
	readonly error: undefined
	readonly isLoading: true
	readonly isError: false
	readonly hasData: boolean
}

export interface AsyncData<T> {
	readonly status: "data"
	readonly data: T
	readonly error: undefined
	readonly isLoading: false
	readonly isError: false
	readonly hasData: true
}

export interface AsyncError<T> {
	readonly status: "error"
	/** Previous data, if available */
	readonly data: T | undefined
	readonly error: unknown
	readonly isLoading: false
	readonly isError: true
	readonly hasData: boolean
}

// ── Constructors ───────────────────────────────────────────────

export function asyncLoading<T>(previousData?: T): AsyncValue<T> {
	return {
		status: "loading",
		data: previousData,
		error: undefined,
		isLoading: true,
		isError: false,
		hasData: previousData !== undefined,
	}
}

export function asyncData<T>(data: T): AsyncValue<T> {
	return {
		status: "data",
		data,
		error: undefined,
		isLoading: false,
		isError: false,
		hasData: true,
	}
}

export function asyncError<T>(
	error: unknown,
	previousData?: T,
): AsyncValue<T> {
	return {
		status: "error",
		data: previousData,
		error,
		isLoading: false,
		isError: true,
		hasData: previousData !== undefined,
	}
}

// ── Pattern Matching ───────────────────────────────────────────

export interface AsyncValueMatchers<T, R> {
	data: (data: T) => R
	loading: () => R
	error: (error: unknown) => R
}

/** Exhaustive pattern matching on AsyncValue — like Riverpod's .when() */
export function when<T, R>(
	value: AsyncValue<T>,
	matchers: AsyncValueMatchers<T, R>,
): R {
	switch (value.status) {
		case "data":
			return matchers.data(value.data)
		case "loading":
			return matchers.loading()
		case "error":
			return matchers.error(value.error)
	}
}

/** Partial pattern matching — returns undefined for unhandled states */
export function whenOrNull<T, R>(
	value: AsyncValue<T>,
	matchers: Partial<AsyncValueMatchers<T, R>>,
): R | undefined {
	switch (value.status) {
		case "data":
			return matchers.data?.(value.data)
		case "loading":
			return matchers.loading?.()
		case "error":
			return matchers.error?.(value.error)
	}
}

// ── Transformers ───────────────────────────────────────────────

/** Map the data inside an AsyncValue, preserving the status */
export function mapAsyncValue<T, U>(
	value: AsyncValue<T>,
	fn: (data: T) => U,
): AsyncValue<U> {
	switch (value.status) {
		case "data":
			return asyncData(fn(value.data))
		case "loading":
			return asyncLoading(
				value.data !== undefined ? fn(value.data) : undefined,
			)
		case "error":
			return asyncError(
				value.error,
				value.data !== undefined ? fn(value.data) : undefined,
			)
	}
}

/** Extract data or throw if not in data state */
export function requireData<T>(value: AsyncValue<T>): T {
	if (value.status === "data") return value.data
	if (value.hasData && value.data !== undefined) return value.data
	throw new Error(
		`AsyncValue has no data. Current status: ${value.status}` +
			(value.status === "error" ? ` — ${value.error}` : ""),
	)
}

/** Check if two AsyncValues are equal (by reference for data) */
export function asyncValueEquals<T>(
	a: AsyncValue<T>,
	b: AsyncValue<T>,
): boolean {
	if (a.status !== b.status) return false
	if (!Object.is(a.data, b.data)) return false
	if (!Object.is(a.error, b.error)) return false
	return true
}
