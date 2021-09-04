import asyncio
import os
from stat import S_ISFIFO

from ...exceptions import InvalidStreamMode
from ...exceptions import NoActiveGroupCall
from ...exceptions import NodeJSNotRunning
from ...exceptions import NoMtProtoClientSet
from ...scaffold import Scaffold
from ...stream_type import StreamType
from ...types.input_stream import InputAudioStream
from ...types.input_stream import InputVideoStream


class JoinGroupCall(Scaffold):
    async def join_group_call(
        self,
        chat_id: int,
        stream_audio: InputAudioStream,
        stream_video: InputVideoStream = None,
        invite_hash: str = None,
        join_as=None,
        stream_type: StreamType = None,
    ):
        if join_as is None:
            join_as = self._cache_local_peer
        if stream_type is None:
            stream_type = StreamType().local_stream
        if stream_type.stream_mode == 0:
            raise InvalidStreamMode()
        self._cache_user_peer.put(chat_id, join_as)
        if stream_video is not None:
            if (not os.path.isfile(stream_video.path)) and (not S_ISFIFO(os.stat(stream_video.path).st_mode)):
                raise FileNotFoundError()
        if (not os.path.isfile(stream_audio.path)) and (not S_ISFIFO(os.stat(stream_video.path).st_mode)):
            raise FileNotFoundError()
        if self._app is not None:
            if self._wait_until_run is not None:
                if not self._wait_until_run.done():
                    await self._wait_until_run
                chat_call = await self._app.get_full_chat(
                    chat_id,
                )
                if chat_call is not None:
                    async def internal_sender():
                        request = {
                            'action': 'join_call',
                            'chat_id': chat_id,
                            'stream_audio': {
                                'path': stream_audio.path,
                                'bitrate': stream_audio.parameters.bitrate,
                            },
                            'invite_hash': invite_hash,
                            'buffer_long': stream_type.stream_mode,
                        }
                        if stream_video is not None:
                            video_parameters = stream_video.parameters
                            request['stream_video'] = {
                                'path': stream_video.path,
                                'width': video_parameters.width,
                                'height': video_parameters.height,
                                'framerate': video_parameters.frame_rate,
                            }
                        await self._binding.send(request)
                    asyncio.ensure_future(internal_sender())
                else:
                    raise NoActiveGroupCall()
            else:
                raise NodeJSNotRunning()
        else:
            raise NoMtProtoClientSet()
