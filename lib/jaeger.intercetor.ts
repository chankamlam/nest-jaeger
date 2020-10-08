import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpService,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { initTracer } from "jaeger-client";
import { FORMAT_HTTP_HEADERS, Tags } from "opentracing";
import axios from "axios";

const TAGS = {
  ...Tags,
  PROTOCAL: "protocal",
  TRACING_TAG: "tracing-tag",
};

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
  serviceName: "Unknow",
  reporter: DEFAULT_REPORTER,
  sampler: DEFAULT_SAMPLER,
};

@Injectable()
export class JaegerInterceptor implements NestInterceptor {
  // tracer instance, one request one tracer
  private tracer: any = undefined;
  // master span instance, can have mutilpe chirld span inside
  private span: any = undefined;
  // tracing tag from request and will pass to remote call
  private tracing_tag: any = {};
  // callback function form user
  private cb: any = undefined;

  constructor(cfg?: {}, opt?: {}, cb?: undefined) {
    // init tracer
    if (!this.tracer) {
      try {
        const config = { ...DEFAULT_CONFIG, ...cfg };
        const options = { ...DEFAULT_OPTION, ...opt };
        this.tracer = initTracer(config, options);
        cb && (this.cb = cb);
        console.log("[*]Init tracer ... [ DONE ] ");
      } catch (error) {
        console.error("[*]Init tracer ... [ FAILED ] ");
      }
    } else {
      console.log(`[*]Tracer already existed`);
    }
  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    //////////////////////////////////////////////////////////////////
    // handle metadata
    const reflector = new Reflector();
    const except = reflector.get<boolean>(
      "ExceptJaegerInterceptor",
      context.getHandler()
    );
    if (except) return next.handle();
    ////////////////////////////////////////////////////////////////////

    // extract parent span from headers of request
    if (!this.tracer) return next.handle();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const parent = this.tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
    const parentObj = parent ? { childOf: parent } : {};
    this.span = this.tracer.startSpan(req.headers.host + req.path, parentObj);
    ///////////////////////////////////////////////////////////////////////////

    // get tracing tag from headers of request
    if (!this.span) return next.handle();
    if (req.headers && req.headers[TAGS.TRACING_TAG]) {
      this.tracing_tag = JSON.parse(req.headers[TAGS.TRACING_TAG]);
    }
    for (const key in this.tracing_tag) {
      const val = this.tracing_tag[key];
      this.span.setTag(key, val);
    }
    ////////////////////////////////////////////////////////////////////////////

    const createJaegerInstance = () => {
      return {
        // master span instance
        span: this.span,
        // tracer instance
        tracer: this.tracer,
        // TAGS of opentracing
        tags: TAGS,
        // use for remote call
        axios: (opts: any = undefined) => {
          if (!opts) return;
          // inject tracing tag to remote call
          var options = {};
          var headers = {};
          headers[TAGS.TRACING_TAG] = JSON.stringify(this.tracing_tag);
          this.tracer.inject(this.span, FORMAT_HTTP_HEADERS, headers);
          opts.headers = { ...opts.headers, ...headers };
          options = { ...opts };
          ///////////////////////////////////////////////////////////
          return axios(options);
        },
        // log
        log: (name, content) => {
          if (!this.span) return;
          this.span.logEvent(name, content);
        },
        // setup tag
        setTag: (tag, val) => {
          if (!this.span) return;
          this.span.setTag(tag, val);
        },
        // setup mutiple TAGS
        addTags: (obj) => {
          if (!this.span && !obj) return;
          this.span.addTags(obj);
        },
        // setup tracing tag which can pass through all remote call by using Jaeger.request
        setTracingTag: (tag, val) => {
          if (!this.span) return;
          this.span.setTag(tag, val);
          this.tracing_tag[tag] = val;
        },
        // finish span job
        finish: () => {
          if (!this.span) return;
          this.span.finish();
        },
        // create new span under master span
        createSpan: (name, parent) => {
          const parentObj = parent
            ? { childOf: parent }
            : { childOf: this.span };
          if (!this.tracer) return;
          return this.tracer.startSpan(name, parentObj);
        },
      };
    };

    req.jaeger = createJaegerInstance();

    // mark default tag of request
    req.jaeger.setTag("request.ip", req.ip);
    req.jaeger.setTag("request.method", req.method);
    req.jaeger.setTag("request.headers", req.headers);
    req.jaeger.setTag("request.path", req.path);
    req.jaeger.setTag("request.body", req.body);
    req.jaeger.setTag("request.query", req.query);
    //////////////////////////////////////////////////

    // handle customize callback from user
    if (this.cb) {
      this.cb(req, res);
    }
    ///////////////////////////////////////////////

    return next.handle().pipe(
      tap(() => {
        //mark default tag of response
        req.jaeger.setTag("response.state", res.statusCode);
        req.jaeger.setTag("response.result", res.statusMessage);
        req.jaeger.finish();
        ///////////////////////////////////////////////////
      })
    );
  }
}
