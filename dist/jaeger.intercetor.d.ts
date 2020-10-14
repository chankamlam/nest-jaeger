import { NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
export declare class JaegerInterceptor implements NestInterceptor {
    private tracer;
    private span;
    private tracing_tag;
    private req_cb;
    private res_cb;
    constructor(cfg?: {}, opt?: {}, req_cb?: any, res_cb?: any);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
