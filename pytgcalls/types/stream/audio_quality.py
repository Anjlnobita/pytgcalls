from enum import Enum


class AudioQuality(Enum):
    STUDIO = (256000, 2)
    HIGH = (96000, 2)
    MEDIUM = (48000, 2)
    LOW = (36000, 2)
