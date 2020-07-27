import { HttpServer, RequestMethod } from '@nestjs/common';
export interface CustomHeader {
    name: string;
    value: string;
}
export interface RedirectResponse {
    url: string;
    statusCode?: number;
}
export declare class RouterResponseController {
    private readonly applicationRef;
    constructor(applicationRef: HttpServer);
    apply<TInput = any, TResponse = any>(result: TInput, response: TResponse, httpStatusCode?: number): Promise<any>;
    redirect<TInput = any, TResponse = any>(resultOrDeferred: TInput, response: TResponse, redirectResponse: RedirectResponse): Promise<void>;
    render<TInput = unknown, TResponse = unknown>(resultOrDeferred: TInput, response: TResponse, template: string): Promise<void>;
    transformToResult(resultOrDeferred: any): Promise<any>;
    getStatusByMethod(requestMethod: RequestMethod): number;
    setHeaders<TResponse = unknown>(response: TResponse, headers: CustomHeader[]): void;
    setStatus<TResponse = unknown>(response: TResponse, statusCode: number): void;
}
