import { initDatabaseAPI, workerPromise } from '@/api';
import Emitter from '@/utils/emitter';
import { v4 as uuidv4 } from 'uuid';
import { WSEvent } from '../types';
import { getGO, initializeWasm, getGoExitPromsie } from './initialize';

import {
  AdvancedMsgParams,
  AdvancedQuoteMsgParams,
  CustomMsgParams,
  GetAdvancedHistoryMsgParams,
  GetGroupMemberParams,
  GetHistoryMsgParams,
  GetOneConversationParams,
  ImageMsgParams,
  LoginParam,
  MarkC2CParams,
  MarkNotiParams,
  QuoteMsgParams,
  SendMsgParams,
} from '../types/params';

import { IMConfig, WsResponse } from '../types/entity';

class SDK extends Emitter {
  private wasmInitializedPromise: Promise<any>;
  private goExitPromise: Promise<void> | undefined;
  private goExisted = false;

  constructor(url = '/main.wasm') {
    super();

    initDatabaseAPI();
    this.wasmInitializedPromise = initializeWasm(url);
    this.goExitPromise = getGoExitPromsie();

    if (this.goExitPromise) {
      this.goExitPromise
        .then(() => {
          console.info('SDK => wasm exist');
        })
        .catch(err => {
          console.info('SDK => wasm with error ', err);
        })
        .finally(() => {
          this.goExisted = true;
        });
    }
  }

  async _invoker(
    functionName: string,
    func: (...args: any[]) => Promise<any>,
    args: any[],
    processor?: (data: string) => string
  ) {
    console.info(
      `SDK => [OperationID:${
        args[0]
      }] (invoked by js) run ${functionName} with args ${JSON.stringify(args)}`
    );

    let response: { data?: any } = {};
    try {
      if (!getGO() || getGO().exited || this.goExisted) {
        throw 'wasm exist already, fail to run';
      }

      let data = await func(...args);
      if (processor) {
        console.info(
          `SDK => [OperationID:${
            args[0]
          }] (invoked by js) run ${functionName} with response before processor ${JSON.stringify(
            data
          )}`
        );
        data = processor(data);
      }
      response = { data };
    } catch (error) {
      console.info(
        `SDK => [OperationID:${
          args[0]
        }] (invoked by js) run ${functionName} with error ${JSON.stringify(
          error
        )}`
      );
    }

    console.info(
      `SDK => [OperationID:${
        args[0]
      }] (invoked by js) run ${functionName} with response ${JSON.stringify(
        response
      )}`
    );

    return response as WsResponse;
  }
  async login(params: LoginParam, operationID = uuidv4()) {
    console.info(
      `SDK => (invoked by js) run login with args ${JSON.stringify({
        params,
        operationID,
      })}`
    );

    await workerPromise;
    await this.wasmInitializedPromise;
    window.commonEventFunc(event => {
      try {
        console.info('SDK => received event ', event);
        const parsed = JSON.parse(event) as WSEvent;

        this.emit(parsed.event, parsed);
      } catch (error) {
        console.error(error);
      }
    });

    const config: IMConfig = {
      platform: params.platformID,
      api_addr: params.apiAddress,
      ws_addr: params.wsAddress,
      log_level: params.logLevel || 6,
    };
    window.initSDK(operationID, JSON.stringify(config));

    return await window.login(operationID, params.userID, params.token);
  }
  async logout(operationID = uuidv4()) {
    return await this._invoker('logout', window.logout, [operationID]);
  }
  async getAllConversationList(operationID = uuidv4()) {
    return await this._invoker(
      'getAllConversationList',
      window.getAllConversationList,
      [operationID]
    );
  }
  async getOneConversation(
    params: GetOneConversationParams,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'getOneConversation',
      window.getOneConversation,
      [operationID, params.sessionType, params.sourceID]
    );
  }
  async getAdvancedHistoryMessageList(
    params: GetAdvancedHistoryMsgParams,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'getAdvancedHistoryMessageList',
      window.getAdvancedHistoryMessageList,
      [operationID, JSON.stringify(params)]
    );
  }
  async getHistoryMessageList(
    params: GetHistoryMsgParams,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'getHistoryMessageList',
      window.getHistoryMessageList,
      [operationID, JSON.stringify(params)]
    );
  }
  async getGroupsInfo(params: string[], operationID = uuidv4()) {
    return await this._invoker('getGroupsInfo', window.getGroupsInfo, [
      operationID,
      JSON.stringify(params),
    ]);
  }
  async deleteConversationFromLocalAndSvr(
    conversationID: string,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'deleteConversationFromLocalAndSvr',
      window.deleteConversationFromLocalAndSvr,
      [operationID, conversationID]
    );
  }
  async markC2CMessageAsRead(params: MarkC2CParams, operationID = uuidv4()) {
    return await this._invoker(
      'markC2CMessageAsRead',
      window.markC2CMessageAsRead,
      [operationID, params.userID, JSON.stringify(params.msgIDList)]
    );
  }
  async markMessageAsReadByConID(
    params: MarkNotiParams,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'markMessageAsReadByConID',
      window.markMessageAsReadByConID,
      [operationID, params.conversationID, JSON.stringify(params.msgIDList)]
    );
  }
  async markNotifyMessageHasRead(
    conversationID: string,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'markNotifyMessageHasRead',
      window.markMessageAsReadByConID,
      [operationID, conversationID, '[]']
    );
  }
  async getGroupMemberList(
    params: GetGroupMemberParams,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'getGroupMemberList',
      window.getGroupMemberList,
      [operationID, params.groupID, params.filter, params.offset, params.count]
    );
  }
  async createTextMessage(text: string, operationID = uuidv4()) {
    return await this._invoker(
      'createTextMessage',
      window.createTextMessage,
      [operationID, text],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  }
  async createImageMessage(params: ImageMsgParams, operationID = uuidv4()) {
    return await this._invoker(
      'createImageMessage',
      window.createImageMessageByURL,
      [
        operationID,
        JSON.stringify(params.sourcePicture),
        JSON.stringify(params.bigPicture),
        JSON.stringify(params.snapshotPicture),
      ],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  }
  async createCustomMessage(params: CustomMsgParams, operationID = uuidv4()) {
    return await this._invoker(
      'createCustomMessage',
      window.createCustomMessage,
      [operationID, params.data, params.extension, params.description],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  }
  async createQuoteMessage(params: QuoteMsgParams, operationID = uuidv4()) {
    return await this._invoker(
      'createQuoteMessage',
      window.createQuoteMessage,
      [operationID, params.text, params.message],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  }
  async createAdvancedQuoteMessage(
    params: AdvancedQuoteMsgParams,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'createAdvancedQuoteMessage',
      window.createAdvancedQuoteMessage,
      [
        operationID,
        params.text,
        params.message,
        JSON.stringify(params.messageEntityList),
      ],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  }
  async createAdvancedTextMessage(
    params: AdvancedMsgParams,
    operationID = uuidv4()
  ) {
    return await this._invoker(
      'createAdvancedTextMessage',
      window.createAdvancedTextMessage,
      [operationID, params.text, JSON.stringify(params.messageEntityList)],
      data => {
        // compitable with old version sdk
        return data[0];
      }
    );
  }
  async sendMessage(params: SendMsgParams, operationID = uuidv4()) {
    return await this._invoker('sendMessage', window.sendMessage, [
      operationID,
      params.message,
      params.recvID,
      params.groupID,
      JSON.stringify(params.offlinePushInfo),
    ]);
  }
  async sendMessageNotOss(params: SendMsgParams, operationID = uuidv4()) {
    return await this._invoker('sendMessageNotOss', window.sendMessageNotOss, [
      operationID,
      params.message,
      params.recvID,
      params.groupID,
      JSON.stringify(params.offlinePushInfo),
    ]);
  }
}

let instance: SDK;

export function getSDK(url = '/main.wasm'): SDK {
  if (typeof window === 'undefined') {
    return {} as SDK;
  }

  if (instance) {
    return instance;
  }

  instance = new SDK(url);

  return instance;
}
