import asyncio
import logging
from collections import deque


class SSELogHandler(logging.Handler):
    def __init__(self, maxlen: int = 500):
        super().__init__()
        self.queue: asyncio.Queue = asyncio.Queue()
        self.history: deque = deque(maxlen=maxlen)

    def emit(self, record: logging.LogRecord) -> None:
        msg = self.format(record)
        self.history.append(msg)
        try:
            self.queue.put_nowait(msg)
        except asyncio.QueueFull:
            pass


log_handler = SSELogHandler()
log_handler.setFormatter(logging.Formatter("%(message)s"))

logger = logging.getLogger("r4mi")
logger.addHandler(log_handler)
logger.setLevel(logging.INFO)

# Also capture to stdout for Docker logs
_stdout_handler = logging.StreamHandler()
_stdout_handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
logger.addHandler(_stdout_handler)
