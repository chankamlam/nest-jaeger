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
const { initTracer } = require("jaeger-client");
const { FORMAT_HTTP_HEADERS, Tags } = require("opentracing");
const axios = require("axios");
const debug = require("debug")("log");
const tags = Object.assign(Object.assign({}, Tags), { "PROTOCAL": "protocal", "TRACING_TAG": "tracing-tag" });
const defaultSampler = {
    type: "const",
    param: 1
};
const defaultReporter = {
    collectorEndpoint: "http://localhost:14268/api/traces",
};
const defaultLogger = {
    info: msg => {
        console.log("JAEGER INFO ", msg);
    },
    error: msg => {
        console.log("JAEGER ERROR", msg);
    }
};
const defaultOptions = { logger: defaultLogger };
const defaultConfig = {
    serviceName: "Unknow",
    reporter: defaultReporter,
    sampler: defaultSampler
};
let JaegerInterceptor = class JaegerInterceptor {
    constructor(cfg, opt, cb) {
        this.tracer = undefined;
        this.span = undefined;
        this.tracing_tag = {};
        this.cb = undefined;
        if (!this.tracer) {
            const config = Object.assign(Object.assign({}, defaultConfig), cfg);
            const options = Object.assign(Object.assign({}, defaultOptions), opt);
            this.tracer = initTracer(config, options);
            this.cb = cb;
            debug("init tracer ...");
        }
        else {
            debug("tracer already exsited");
        }
    }
    intercept(context, next) {
        const reflector = new core_1.Reflector();
        const except = reflector.get('ExceptJaegerInterceptor', context.getHandler());
        if (except)
            return next.handle();
        if (!this.tracer)
            return next.handle();
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const parent = this.tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
        const parentObj = parent ? { childOf: parent } : {};
        this.span = this.tracer.startSpan(req.headers.host + req.path, parentObj);
        debug("===== headers =====");
        debug(req.headers);
        if (!this.span)
            return next.handle();
        if (req.headers && req.headers[tags.TRACING_TAG]) {
            this.tracing_tag = JSON.parse(req.headers[tags.TRACING_TAG]);
        }
        for (const key in this.tracing_tag) {
            const val = this.tracing_tag[key];
            this.span.setTag(key, val);
        }
        debug("===== tracing_tag =====");
        debug(this.tracing_tag);
        const createJaegerInstance = () => {
            return {
                span: this.span,
                tracer: this.tracer,
                tags,
                axios: (opts = undefined) => {
                    if (!opts)
                        return;
                    var options = {};
                    var headers = {};
                    headers[tags.TRACING_TAG] = JSON.stringify(this.tracing_tag);
                    this.tracer.inject(this.span, FORMAT_HTTP_HEADERS, headers);
                    opts.headers = Object.assign(Object.assign({}, opts.headers), headers);
                    options = Object.assign({}, opts);
                    debug("==========request headers======");
                    debug(opts.headers);
                    return axios(options);
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
                    debug("===== tracing_tag =====");
                    debug(this.tracing_tag);
                },
                finish: () => {
                    if (!this.span)
                        return;
                    this.span.finish();
                },
                createSpan: (name) => {
                    if (!this.tracer)
                        return;
                    return this.tracer.startSpan(name, { childOf: this.span });
                }
            };
        };
        req.jaeger = createJaegerInstance();
        req.jaeger.setTag("request.ip", req.ip);
        req.jaeger.setTag("request.method", req.method);
        req.jaeger.setTag("request.headers", req.headers);
        req.jaeger.setTag("request.path", req.path);
        req.jaeger.setTag("request.body", req.body);
        req.jaeger.setTag("request.query", req.query);
        if (this.cb) {
            this.cb(req, res);
        }
        return next
            .handle()
            .pipe(operators_1.tap(() => {
            req.jaeger.setTag("response.state", res.statusCode);
            req.jaeger.setTag("response.result", res.statusMessage);
            req.jaeger.finish();
        }));
    }
};
JaegerInterceptor = __decorate([
    common_1.Injectable(),
    __metadata("design:paramtypes", [Object, Object, Object])
], JaegerInterceptor);
exports.JaegerInterceptor = JaegerInterceptor;
