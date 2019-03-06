


export default class CancelSignalSource {
    constructor(linkedSignals=[]) {
        // eslint-disable-next-line no-param-reassign
        linkedSignals = [...linkedSignals]
        const source = this
        this._subscriptions = new Map()
        this._state = 'waiting'

        const cancelSignal = Object.freeze({
            get signaled() {
                return source._state === 'signaled'
            },

            subscribe(callback) {
                if (source._state === 'signaled') {
                    callback()
                    return Object.freeze({
                        unsubscribe() {
                            /* Nothing to do if the cancellation has
                                already happened */
                        },
                    })
                }
                const subscription = Object.freeze({
                    unsubscribe() {
                        // This check prevents duplicate callbacks
                        // being removed from the same subscription
                        // e.g. if we have:
                        //   sub1 = signal.subscribe(console.log)
                        //   sub2 = signal.subscribe(console.log)
                        // then this prevents using sub1.unsubscribe()
                        // twice to remove sub2
                        source._subscriptions.delete(subscription)
                    },
                })
                source._subscriptions.set(subscription, callback)
                return subscription
            },
        })

        this._signal = cancelSignal

        for (const linkedSignal of linkedSignals) {
            if (linkedSignal.signaled) {
                this._linkedSubscriptions = null
                this._state = 'signaled'
                break
            }
        }

        if (this._state !== 'signaled') {
            const linkedSubscriptions = linkedSignals.map(linkedSignal => {
                return linkedSignal.subscribe(_ => {
                    this.cancel()
                })
            })
            this._linkedSubscriptions = linkedSubscriptions
        }
    }

    get signal() {
        return this._signal
    }

    cancel() {
        if (this._state === 'closed' || this._state === 'signaled') {
            return Promise.resolve()
        }
        this._state = 'signaled'
        const callbacks = [...this._subscriptions.values()]
        const result = Promise.all(callbacks.map(callback => {
            try {
                const result = callback()
                return Promise.resolve(result)
            } catch (error) {
                return Promise.reject(error)
            }
        }))
        this._subscriptions = null
        return result.then(_ => undefined)
    }

    close() {
        if (this._state === 'closed' || this._state === 'signaled') {
            return
        }
        this._state = 'closed'
        for (const subscription of this._linkedSubscriptions) {
            subscription.unsubscribe()
        }
        this._linkedSubscriptions = null
        this._subscriptions = null
    }
}
