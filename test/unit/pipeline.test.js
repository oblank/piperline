/* eslint-disable new-cap, prefer-template */

import Pipeline from '../../src/index';
import utils from '../../src/utils';
import chai from 'chai';
import spies from 'chai-spies';

chai.use(spies);
const should = chai.should();

describe('piperline', () => {
    let line = null;

    beforeEach(() => {
        line = Pipeline.create();
    });

    describe('building', () => {
        it('should execute in order', (done) => {
            let result = '';
            line
                .pipe((data, next) => {
                    result += '1';
                    utils.executeAsAsync(() => next());
                })
                .pipe((data, next) => {
                    result += '2';
                    utils.executeAsAsync(() => next());
                })
                .pipe((data, next) => {
                    result += '3';
                    utils.executeAsAsync(() => next());
                })
                .on('done', () => {
                    result.should.be.equal('123');
                    done();
                })
                .run();
        });
    });

    describe('data flow', () => {
        it('should pass down the data', (done) => {
            line
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + '1'));
                })
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + '2'));
                })
                .pipe((data, next, complete) => {
                    utils.executeAsAsync(() => complete(data + '3'));
                })
                .on('done', (data) => {
                    data.should.be.equal('123');
                    done();
                })
                .run('');
        });
    });

    describe('execution', () => {
        it('should NOT run until the previous execution completed', (done) => {
            function ShouldFail() {
                line
                    .pipe((data, next) => utils.executeAsAsync(() => next(data)))
                    .pipe((data, next) => utils.executeAsAsync(() => next(data)))
                    .pipe((data, next) => utils.executeAsAsync(() => next(data)));

                line.run(0);
                line.run(0);
            }

            ShouldFail.should.Throw();
            done();
        });

        it('should NOT execute `next()` and `done()` at the same time', (done) => {
            const callbacksCount = 2;
            let callbacks = 0;

            function callback() {
                callbacks += 1;

                if (callbacks === callbacksCount) {
                    done();
                }
            }

            const spy1 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data + 1));
            });

            Pipeline.create()
                .pipe((data, next, complete) => {
                    utils.executeAsAsync(() => next(data + 1));
                    utils.executeAsAsync(() => complete(data));
                })
                .pipe(spy1)
                .on('done', (result) => {
                    result.should.be.equal(2);
                    spy1.should.have.been.called.once();
                    callback();
                })
                .on('error', callback)
                .run(0);

            const spy2 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data + 1));
            });

            Pipeline.create()
                .pipe((data, next, complete) => {
                    utils.executeAsAsync(() => complete(data));
                    utils.executeAsAsync(() => next(data + 1));
                })
                .pipe(spy2)
                .on('done', (result) => {
                    result.should.be.equal(0);
                    spy2.should.not.have.been.called();
                    callback();
                })
                .on('error', callback)
                .run(0);
        });

        it('should execute `next()` only once per call', (done) => {
            const spy1 = chai.spy((data, next, complete) => {
                utils.executeAsAsync(() => complete(data + 1));
            });

            let result = 0;
            let called = false;

            function callback(data) {
                result += data;
                if (!called) {
                    called = true;

                    setTimeout(() => {
                        result.should.be.equal(2);
                        spy1.should.have.been.called.once();
                        done();
                    }, 100);
                }
            }

            Pipeline.create()
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 1));
                    utils.executeAsAsync(() => next(data + 1));
                })
                .pipe(spy1)
                .on('done', callback)
                .run(0);
        });

        it('should execute `done()` only once per run', (done) => {
            const spy1 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data + 1));
            });

            let result = 0;
            let called = false;

            function callback(data) {
                result += data;
                if (!called) {
                    called = true;

                    setTimeout(() => {
                        result.should.be.equal(1);
                        spy1.should.not.have.been.called();
                        done();
                    }, 100);
                }
            }

            Pipeline.create()
                .pipe((data, next, complete) => {
                    utils.executeAsAsync(() => complete(data + 1));
                    utils.executeAsAsync(() => complete(data + 1));
                })
                .pipe(spy1)
                .on('done', callback)
                .run(0);
        });

        it('should stop execution', (done) => {
            const spy1 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data + 1));
            });

            const spy2 = chai.spy((data, next, complete) => {
                utils.executeAsAsync(() => complete(data + 2));
            });

            const spy3 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data + 3));
            });

            line
                .pipe(spy1)
                .pipe(spy2)
                .pipe(spy3)
                .on('done', (data) => {
                    spy1.should.have.been.called();
                    spy2.should.have.been.called();
                    spy3.should.not.have.been.called();
                    data.should.be.equal(3);
                    done();
                })
                .run(0);
        });

        it('should handle errors', (done) => {
            const doneSpy = chai.spy();
            const error = new Error('Test error');

            line
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 1));
                })
                .pipe(() => {
                    throw error;
                })
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 1));
                })
                .on('done', doneSpy)
                .on('error', (err) => {
                    err.should.be.equal(error);
                    doneSpy.should.not.have.been.called();
                    done();
                })
                .run(0);
        });

        it('should be able to run multiple times', (done) => {
            const spy1 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next());
            });

            const spy2 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next());
            });

            line
                .pipe(spy1)
                .pipe(spy2)
                .run(0, (err, result) => {
                    should.not.exist(err);
                    line.run(result, () => {
                        done();
                    });
                });
        });

        it('should emit error by passing `Error` object to `complete` callback', (done) => {
            const errSpy = chai.spy();

            line
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data));
                })
                .pipe((data, next, complete) => {
                    utils.executeAsAsync(() => complete(new Error('Test error')));
                })
                .on('error', errSpy)
                .run(0, (err, data) => {
                    should.exist(err);
                    should.not.exist(data);

                    setTimeout(() => {
                        errSpy.should.have.been.called();
                        done();
                    }, 10);
                });
        });

        it('should emit error by passing `Error` object to `next` callback and terminate the execution', (done) => {
            const errSpy = chai.spy();
            const spy = chai.spy((data, next) => {
                utils.executeAsAsync(() => next());
            });

            line
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(new Error('Test error')));
                })
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data));
                })
                .pipe(spy)
                .on('error', errSpy)
                .run(0, (err, data) => {
                    should.exist(err);
                    should.not.exist(data);

                    setTimeout(() => {
                        errSpy.should.have.been.called();
                        spy.should.not.have.been.called();
                        done();
                    }, 10);
                });
        });

        it('should terminate the execution if initial data is `Error`', (done) => {
            const errSpy = chai.spy();
            const spy1 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next());
            });

            const spy2 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next());
            });

            const spy3 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next());
            });

            line
                .pipe(spy1)
                .pipe(spy2)
                .pipe(spy3)
                .on('error', errSpy)
                .run(new Error('Test error'), (err, data) => {
                    should.exist(err);
                    should.not.exist(data);

                    setTimeout(() => {
                        errSpy.should.have.been.called();
                        spy1.should.not.have.been.called();
                        spy2.should.not.have.been.called();
                        spy3.should.not.have.been.called();
                        done();
                    }, 10);
                });
        });

        it('should be able to add new pipes', (done) => {
            const spy1 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data));
            });

            const spy2 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data));
            });

            const spy3 = chai.spy((data, next) => {
                utils.executeAsAsync(() => next(data));
            });

            line
                .pipe(spy1)
                .pipe(spy2)
                .run(() => {
                    line
                        .pipe(spy3)
                        .run((err, data) => {
                            should.not.exist(err);
                            should.not.exist(data);

                            spy1.should.have.been.called.twice();
                            spy2.should.have.been.called.twice();
                            spy3.should.have.been.called.once();

                            done();
                        });
                });
        });

        it('should throw exception when pipes is tried to be added during execution', (done) => {
            const func = () => {
                line.pipe((data, next) => next());
            };

            line
                .pipe((data, next) => {
                    setTimeout(() => next(), 200);
                })
                .run();

            should.throw(func);
            done();
        });

        it('``isRunning`` property should be up to date', (done) => {
            line.isRunning.should.be.equal(false);

            line
                .pipe((data, next) => {
                    setTimeout(() => next(), 200);
                })
                .run(() => {
                    line.isRunning.should.be.equal(false);
                    done();
                });

            line.isRunning.should.be.equal(true);
        });

        it('should throw an error when pipe handler is not a function', () => {
            const handlers = [
                1,
                '1',
                { foo: 'bar' },
                [1],
                null,
                undefined,
                NaN
            ];

            const shouldFail = () => {
                handlers.forEach(x => line.pipe(x));
            };

            shouldFail.should.Throw();
        });

        it('should emit "end" event when execution is completed (whatever result is)', (done) => {
            const initialValue = 0;
            const callbacks = 2;
            let fired = 0;

            const complete = () => {
                fired += 1;

                if (fired === callbacks) {
                    done();
                }
            };

            Pipeline.create()
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 1));
                })
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 2));
                })
                .on('end', (err, result) => {
                    should.not.exist(err);
                    result.should.eql(3);
                    complete();
                })
                .run(initialValue);

            Pipeline.create()
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 1));
                })
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(new Error('Test')));
                })
                .on('end', (err, result) => {
                    should.exist(err);
                    should.not.exist(result);
                    complete();
                })
                .run(0);
        });

        it('should emit "run" everytime when pipeline was started', (done) => {
            const spy = chai.spy();

            Pipeline.create()
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 1));
                })
                .pipe((data, next) => {
                    utils.executeAsAsync(() => next(data + 2));
                })
                .on('run', spy)
                .on('end', () => {
                    spy.should.have.been.called.once();
                    done();
                })
                .run(0);
        });
    });
});
