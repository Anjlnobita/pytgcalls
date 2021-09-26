import {MultiCoreRTCConnection, RTCConnection} from './rtc-connection';
import { Binding } from './binding';
import * as process from "process";
import {isMainThread} from "worker_threads";

if (isMainThread) {
    const binding = new Binding();
    const connections = new Map<number, any>();
    binding.on('connect', async (userId: number) => {
        let text = `[${userId}] Started Node.js core!`;
        if (process.platform === 'win32') {
            console.log(text);
        } else {
            console.log('\x1b[32m', text, '\x1b[0m');
        }
    });
    binding.on('request', async function (data: any) {
        Binding.log('REQUEST: ' + JSON.stringify(data), Binding.INFO);
        let connection = connections.get(data.chat_id);

        switch (data.action) {
            case 'join_call':
                if (!connection) {
                    if(binding.multi_thread){
                        connection = new MultiCoreRTCConnection(
                            data.chat_id,
                            binding,
                            data.buffer_length,
                            data.invite_hash,
                            data.ffmpeg_parameters,
                            data.stream_audio,
                            data.stream_video,
                            data.lip_sync,
                        );
                    }else{
                        connection = new RTCConnection(
                            data.chat_id,
                            binding,
                            data.buffer_length,
                            data.invite_hash,
                            data.ffmpeg_parameters,
                            data.stream_audio,
                            data.stream_video,
                            data.lip_sync,
                        );
                    }
                    connections.set(data.chat_id, connection);
                    const result = await connection.joinCall();
                    if (result) {
                        await binding.sendUpdate({
                            action: 'update_request',
                            result: 'JOINED_VOICE_CHAT',
                            chat_id: data.chat_id,
                        });
                    } else {
                        connections.delete(data.chat_id);
                        await binding.sendUpdate({
                            result: 'JOIN_ERROR',
                            chat_id: data.chat_id,
                        });
                    }
                }
                break;
            case 'leave_call':
                if (connection) {
                    if (data.type !== 'kicked_from_group') {
                        let result = await connection.leave_call();
                        if (result['result'] === 'OK') {
                            connections.delete(data.chat_id);
                            await binding.sendUpdate({
                                action: 'update_request',
                                result: 'LEFT_VOICE_CHAT',
                                chat_id: data.chat_id,
                            });
                        } else {
                            connections.delete(data.chat_id);
                            await binding.sendUpdate({
                                action: 'update_request',
                                result: 'LEFT_VOICE_CHAT',
                                error: result['result'],
                                chat_id: data.chat_id,
                            });
                        }
                    } else {
                        connection.stop();
                        connections.delete(data.chat_id);
                    }
                }
                break;
            case 'pause':
                if (connection) {
                    try {
                        await connection.pause();
                        await binding.sendUpdate({
                            action: 'update_request',
                            result: 'PAUSED_STREAM',
                            chat_id: data.chat_id,
                        });
                    } catch (e) {}
                }
                break;
            case 'resume':
                if (connection) {
                    try {
                        await connection.resume();
                        await binding.sendUpdate({
                            action: 'update_request',
                            result: 'RESUMED_STREAM',
                            chat_id: data.chat_id,
                        });
                    } catch (e) {}
                }
                break;
            case 'change_stream':
                if (connection) {
                    try {
                        await connection.changeStream(
                            data.ffmpeg_parameters,
                            data.stream_audio,
                            data.stream_video,
                            data.lip_sync,
                        );
                        await binding.sendUpdate({
                            action: 'update_request',
                            result: 'CHANGED_STREAM',
                            chat_id: data.chat_id,
                        });
                    } catch (e) {}
                }
                break;
            case 'mute_stream':
                if (connection) {
                    connection.mute();
                    await binding.sendUpdate({
                        action: 'update_request',
                        result: 'MUTED_STREAM',
                        chat_id: data.chat_id,
                    });
                }
                break;
            case 'unmute_stream':
                if (connection) {
                    connection.unmute();
                    await binding.sendUpdate({
                        action: 'update_request',
                        result: 'UNMUTED_STREAM',
                        chat_id: data.chat_id,
                    });
                }
                break;
        }
    });
}
