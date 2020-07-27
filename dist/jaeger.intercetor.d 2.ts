import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare class JaegerInterceptor implements NestInterceptor {
    private tracer;
    private span;
    private tracing_tag;
    private cb;
    constructor(cfg?: any, opt?: any, cb?: any);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
