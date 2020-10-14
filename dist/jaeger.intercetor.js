"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JaegerInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const operators_1 = require("rxjs/operators");
const jaeger_client_1 = require("jaeger-client");
const opentracing_1 = require("opentracing");
const axios_1 = require("axios");
const TAGS = Object.assign(Object.assign({}, opentracing_1.Tags), { PROTOCAL: "protocal", TRACING_TAG: "tracing-tag" });
const UNKNOW = "Unknow";
const DEFAULT_SAMPLER = {
    type: "const",
    param: 1,
};
const DEFAULT_REPORTER = {
    collectorEndpoint: "http://localhost:14268/api/traces",
};
const DEFAULT_LOGGER = {
    info: (msg) => {
        console.log("JAEGER INFO ", msg);
    },
    error: (msg) => {
        console.log("JAEGER ERROR", msg);
    },
};
const DEFAULT_OPTION = { logger: DEFAULT_LOGGER };
const DEFAULT_CONFIG = {
    serviceName: UNKNOW,
    reporter: DEFAULT_REPORTER,
    sampler: DEFAULT_SAMPLER,
};
let JaegerInterceptor = class JaegerInterceptor {
    constructor(cfg, opt, req_cb, res_cb) {
        this.tracer = undefined;
        this.span = undefined;
        this.tracing_tag = {};
        this.req_cb = undefined;
        this.res_cb = undefined;
        if (!this.tracer) {
            try {
                const config = Object.assign(Object.assign({}, DEFAULT_CONFIG), cfg);
                const options = Object.assign(Object.assign({}, DEFAULT_OPTION), opt);
                this.tracer = jaeger_client_1.initTracer(config, options);
                this.req_cb = req_cb;
                this.res_cb = res_cb;
                console.log("[*]Init tracer ... [ DONE ] ");
            }
            catch (error) {
                console.error("[*]Init tracer ... [ FAILED ] ");
            }
        }
        else {
            console.log(`[*]Tracer already existed`);
        }
    }
    intercept(context, next) {
        const reflector = new core_1.Reflector();
        const except = reflector.get("ExceptJaegerInterceptor", context.getHandler());
        if (except)
            return next.handle();
        if (!this.tracer)
            return next.handle();
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const parent = this.tracer.extract(opentracing_1.FORMAT_HTTP_HEADERS, req.headers);
        const parentObj = parent ? { childOf: parent } : {};
        this.span = this.tracer.startSpan(req.headers.host + req.path, parentObj);
        if (!this.span)
            return next.handle();
        if (req.headers && req.headers[TAGS.TRACING_TAG]) {
            this.tracing_tag = JSON.parse(req.headers[TAGS.TRACING_TAG]);
        }
        for (const key in this.tracing_tag) {
            const val = this.tracing_tag[key];
            this.span.setTag(key, val);
        }
        const createJaegerInstance = () => {
            return {
                span: this.span,
                tracer: this.tracer,
                tags: TAGS,
                axios: (opts = undefined) => {
                    if (!opts)
                        return;
                    var options = {};
                    var headers = {};
                    headers[TAGS.TRACING_TAG] = JSON.stringify(this.tracing_tag);
                    this.tracer.inject(this.span, opentracing_1.FORMAT_HTTP_HEADERS, headers);
                    opts.headers = Object.assign(Object.assign({}, opts.headers), headers);
                    options = Object.assign({}, opts);
                    return axios_1.default(options);
                },
                log: (name, content) => {
                    if (!this.span)
                        return;
                    this.span.logEvent(name, content);
                },
                setTag: (tag, val) => {
                    if (!this.span)
                        return;
                    this.span.setTag(tag, val);
                },
                addTags: (obj) => {
                    if (!this.span && !obj)
                        return;
                    this.span.addTags(obj);
                },
                setTracingTag: (tag, val) => {
                    if (!this.span)
                        return;
                    this.span.setTag(tag, val);
                    this.tracing_tag[tag] = val;
                },
                finish: () => {
                    if (!this.span)
                        return;
                    this.span.finish();
                },
                createSpan: (name, parent) => {
                    const parentObj = parent
                        ? { childOf: parent }
                        : { childOf: this.span };
                    if (!this.tracer)
                        return;
                    return this.tracer.startSpan(name, parentObj);
                },
            };
        };
        req.jaeger = createJaegerInstance();
        req.jaeger.setTag("request.ip", req.ip || UNKNOW);
        req.jaeger.setTag("request.method", req.method || UNKNOW);
        req.jaeger.setTag("request.headers", req.headers || UNKNOW);
        req.jaeger.setTag("request.path", req.path || UNKNOW);
        req.jaeger.setTag("request.body", req.body || UNKNOW);
        req.jaeger.setTag("request.query", req.query || UNKNOW);
        if (this.req_cb) {
            this.req_cb(req, res);
        }
        return next.handle().pipe(operators_1.tap(() => {
            if (this.res_cb) {
                this.res_cb(req, res);
            }
            req.jaeger.setTag("response.state", res.statusCode || UNKNOW);
            req.jaeger.setTag("response.result", res.statusMessage || UNKNOW);
            req.jaeger.finish();
        }));
    }
};
JaegerInterceptor = __decorate([
    common_1.Injectable(),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], JaegerInterceptor);
exports.JaegerInterceptor = JaegerInterceptor;
