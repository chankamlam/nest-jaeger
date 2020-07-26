import { Injectable, NestInterceptor, ExecutionContext, CallHandler,HttpService } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
const { initTracer } = require("jaeger-client");
const { FORMAT_HTTP_HEADERS,Tags } = require("opentracing");
const axios = require("axios")
const debug = require("debug")("log")

const tags = {
  ...Tags,
  "PROTOCAL":"protocal",
  "TRACING_TAG":"tracing-tag",
}

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

const defaultConfig =  {
  serviceName:"Unknow",
  reporter: defaultReporter,
  sampler: defaultSampler
};


@Injectable()
export class JaegerInterceptor implements NestInterceptor {
  private tracer:any      = undefined
  private span:any        = undefined
  private tracing_tag:any = {}
  private cb:any          = undefined
  constructor(cfg?:any,opt?:any,cb?:any){
      // init tracer
      if(!this.tracer){
          const config = {...defaultConfig,...cfg}
          const options = {...defaultOptions,...opt}
          this.tracer = initTracer(config, options)
          this.cb = cb
          debug("init tracer ...")
      }else{
        debug("tracer already exsited")
      }
  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {

    // handle metadata
    const reflector = new Reflector()
    const except = reflector.get<boolean>('ExceptJaegerInterceptor', context.getHandler());
    if(except) return next.handle()

    // extract http/https headers
    if(!this.tracer) return next.handle()
    const req = context.switchToHttp().getRequest()
    const res = context.switchToHttp().getResponse()
    const parent = this.tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
    const parentObj = parent ? { childOf: parent } : {};
    this.span = this.tracer.startSpan(req.headers.host+req.path, parentObj);
    debug("===== headers =====")
    debug(req.headers)
    
    // handle tracing tag
    if(!this.span) return next.handle()
    if(req.headers&&req.headers[tags.TRACING_TAG]){
      this.tracing_tag = JSON.parse(req.headers[tags.TRACING_TAG])
    }
    for (const key in this.tracing_tag) {
      const val = this.tracing_tag[key];
      this.span.setTag(key, val);
    }
    debug("===== tracing_tag =====")
    debug(this.tracing_tag)

    const createJaegerInstance = ()=>{
      return {
        // span instance
        span:this.span,
        // tracer instance
        tracer:this.tracer,
        // tags of opentracing
        tags,
        // use for remote call
        axios : (opts:any=undefined)=>{
          if(!opts) return
          // handle tracing tag
          var options = {}
          var headers = {}
          headers[tags.TRACING_TAG] = JSON.stringify(this.tracing_tag)
          this.tracer.inject(this.span, FORMAT_HTTP_HEADERS, headers);
          opts.headers = {...opts.headers,...headers}
          options = {...opts}
          debug("==========request headers======")
          debug(opts.headers)
          return axios(options)
        },
        // log
        log:(name,content)=>{
          if(!this.span) return
          this.span.logEvent(name,content)
        },
        // setup tag
        setTag:(tag,val)=>{
          if(!this.span) return
          this.span.setTag(tag,val)
        },
        // setup mutiple tags
        addTags:(obj)=>{
          if(!this.span && !obj) return
          this.span.addTags(obj)
        },
        // setup tracing tag which can pass through all remote call by using Jaeger.request
        setTracingTag:(tag,val)=>{
          if(!this.span) return
          this.span.setTag(tag,val)
          this.tracing_tag[tag] = val
          debug("===== tracing_tag =====")
          debug(this.tracing_tag)
        },
        // finish span job
        finish:()=>{
          if(!this.span) return
          this.span.finish()
        },
        // create new span under master span
        createSpan:(name)=>{
          if(!this.tracer) return
          return this.tracer.startSpan(name,{ childOf:this.span })
        }
      }
    }
    req.jaeger = createJaegerInstance()
    
    // mark default tag of request
    req.jaeger.setTag("request.ip",req.ip)
    req.jaeger.setTag("request.method",req.method)
    req.jaeger.setTag("request.headers",req.headers)
    req.jaeger.setTag("request.path",req.path)
    req.jaeger.setTag("request.body",req.body)
    req.jaeger.setTag("request.query",req.query)

    // handle callback
    if(this.cb){
      this.cb(req,res)
    }
    
    return next
    .handle()
    .pipe(
      tap(() => {
          //mark default tag of response
          req.jaeger.setTag("response.state", res.statusCode);
          req.jaeger.setTag("response.result", res.statusMessage);
          req.jaeger.finish()
        }),
      );
  }
}