# Nest-Jaeger

**Jaeger middleware to request tracing for nestjs application**

## Required Reading Opentracing 
To fully understand Opentracing, it's helpful to be familiar with the [OpenTracing project](http://opentracing.io) and
[terminology](http://opentracing.io/documentation/pages/spec.html) more specifically.
## Required Reading Jaeger 
To fully understand Jaeger, it's helpful to be familiar with the [Jaeger project](https://www.jaegertracing.io) and [Jaeger Client for Node](https://www.npmjs.com/package/jaeger-client)

## Installation

```
npm i @chankamlam/nest-jaeger -S
```

## Architecture of Jaeger Server
for development
![avatar](https://www.jaegertracing.io/img/architecture-v1.png)
for prodution
![avatar](https://www.jaegertracing.io/img/architecture-v2.png)

## Build up Jaeger Server Infra locally(development env)
```
docker run -d -e COLLECTOR_ZIPKIN_HTTP_PORT=9411 -p5775:5775/udp -p6831:6831/udp -p6832:6832/udp \
  -p5778:5778 -p16686:16686 -p14268:14268 -p9411:9411 jaegertracing/all-in-one:latest
```


## Usage
### main.ts
```
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {JaegerInterceptor} from '@chankamlam/nest-jaeger'
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = {
    serviceName: 'service1-nest',
    sampler: {
        type: "const",
        param: 1
    },
    reporter: {
        collectorEndpoint: "http://localhost:14268/api/traces"
    },
};                                             // required
const options = { baggagePrefix: "-Johua-" };  // optional,you can let options={}

  // setup as global interceptor
  app.useGlobalInterceptors(new JaegerInterceptor(config,options));
  await app.listen(3000);
}
bootstrap();


```
### Controller by using JaegerInterceptor
```
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import {JaegerInterceptor} from "@chankamlam/nest-jaeger";

@Controller()
export class AppController {

  @UseInterceptors(JaegerInterceptor)
   @Get("/test")
   test(){
     return "test"
   }
}

```
### Controller except using JaegerInterceptor when binding JaegerInterceptor globally
```
import { Controller, Get, UseInterceptors, SetMetadata,Req } from '@nestjs/common';
import { AppService } from './app.service';
import {JaegerInterceptor} from "@chankamlam/nest-jaeger";

@Controller()
export class AppController {

   // will use JaegerInterceptor when binding JaegerInterceptor globally
   // using remote request by jaeger.axios
   @Get("/remoteRequest")
   async remoteRequest(@Req req){
     const result = await req.jaeger.axios({url:"xxxxxx",method:"post",data:{key:"1234"}}).then(r=>r.data)
     return result
   }

    // will use JaegerInterceptor when binding JaegerInterceptor globally
   @Get("/test")
   test(@Req req){
     req.jaeger.log("error","err....") // jaeger object is binded after you use JaegerInterceptor globally
     return "test"
   }

   // will not use JaegerInterceptor
   @SetMetadata('ExceptJaegerInterceptor', true)
   @Get("/except")
   test(){
     return "test"
   }
}

```
## Lookup Request Tracing

> open url  http://localhost:16686 , remember to build up the Jager Server locally first

![avatar](https://raw.githubusercontent.com/chankamlam/express-jaeger/master/pic/1.png)
![avatar](https://raw.githubusercontent.com/chankamlam/express-jaeger/master/pic/2.png)

## _config_
> for detail, pls look up to [Jaeger Client for Node](https://www.npmjs.com/package/jaeger-client)
```
{
  serviceName: "string",           // required
  disable: "boolean",
  sampler: {
    type: "string",                // required
    param: "number",               // required
    hostPort: "string",
    host: "string",
    port: "number",
    refreshIntervalMs: "number"
  },
  reporter: {
    logSpans: "boolean",
    agentHost: "string",
    agentPort: "number",
    collectorEndpoint: "string",   // required
    username: "string",
    password: "string",
    flushIntervalMs: "number"
  },
  throttler: {
    host: "string",
    port: "number",
    refreshIntervalMs: "number"
  }
}
```

## _options_
> for detail, pls look up to [Jaeger Client for Node](https://www.npmjs.com/package/jaeger-client)
```
{
    contextKey: "string",
    baggagePrefix: "string",
    metrics: "object", // a metrics
    logger: "object",  // a logger
    tags: "object",    // set of key-value pairs which will be set as process-level tags on the Tracer itself.
    traceId128bit: "boolean",
    shareRpcSpan: "boolean",
    debugThrottler: "boolean",
}
```
## _jaeger_
> jaeger object will bind in req when you do "app.use(jaeger(config,options))"
```
{
  log        : function(name,content)    // write the log to master span
  setTag     : function(name,Value)      // setup tag to master span
  addTags    : function({k1:v1,k2:v2})   // setup mutiple tags to master span
  createSpan : function(name)            // create a new span un der master span
  tags       : object                    // all defined tags of opentracing which can be used
  axios      : function(url,options)     // using it to remote call service if not it will be broken the tracing to next service
}
```
### _log_
```
req.jaeger.log("info","..........")
```
### _setTag_
```
const jaeger = req.jaeger
const tags = jaeger
// using defined tags by opentracing
jaeger.setTag(tags.ERROR,true)
// using your customize tag
jaeger.setTag("warning",true)

```
### _addTags_
```
const jaeger = req.jaeger
const tags = jaeger
// add mutiple tag one time
jaeger.addTags({"error":true,"info":true})
```
### _createSpan_
```
const span = jaeger.createSpan("subSpanName")   // create a sub span under master span
// you also can call method of span
span.log("info","info......")
span.setTag("info",true)
// remember to call finish() if not there is no record send to jaeger
span.finish();
```
### _tags_

### _axios_
jaeger.axios wrap axios with tracing header, for usage detail pls look up to [axios](https://www.npmjs.com/package/axios)

## license
MIT