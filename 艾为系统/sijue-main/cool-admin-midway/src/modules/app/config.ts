import {ModuleConfig} from "@cool-midway/core";
import { AppErrorLogMiddleware } from './middleware/error_log';

export default () => {
  return {
    name: 'listing 优化管理系统',
    description: '系统本体',
    middlewares: [],
    globalMiddlewares: [AppErrorLogMiddleware],
    order: 1,
  } as ModuleConfig;
};
