# Architecture decision records

| Number | Title                                                                      | Status   | Summary                                                                                                                     |
| ------ | -------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| 0001   | [Poll votes and live results](0001-poll-votes-and-live-results.md)         | Accepted | Store one active vote per account and poll, derive counts from vote rows, and publish committed result changes through SSE. |
| 0002   | [Store quack threads separately from quacks](0002-quack-thread-storage.md) | Accepted | Keep reply links on a separate thread so deleting the original quack removes its content while preserving the discussion.   |
