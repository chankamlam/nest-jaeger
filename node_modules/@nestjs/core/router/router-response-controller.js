"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouterResponseController = void 0;
const common_1 = require("@nestjs/common");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
class RouterResponseController {
    constructor(applicationRef) {
        this.applicationRef = applicationRef;
    }
    async apply(result, response, httpStatusCode) {
        return this.applicationRef.reply(response, result, httpStatusCode);
    }
    async redirect(resultOrDeferred, response, redirectResponse) {
        const result = await this.transformToResult(resultOrDeferred);
        const statusCode = result && result.statusCode
            ? result.statusCode
            : redirectResponse.statusCode
                ? redirectResponse.statusCode
                : common_1.HttpStatus.FOUND;
        const url = result && result.url ? result.url : redirectResponse.url;
        this.applicationRef.redirect(response, statusCode, url);
    }
    async render(resultOrDeferred, response, template) {
        const result = await this.transformToResult(resultOrDeferred);
        this.applicationRef.render(response, template, result);
    }
    async transformToResult(resultOrDeferred) {
        if (resultOrDeferred && shared_utils_1.isFunction(resultOrDeferred.subscribe)) {
            return resultOrDeferred.toPromise();
        }
        return resultOrDeferred;
    }
    getStatusByMethod(requestMethod) {
        switch (requestMethod) {
            case common_1.RequestMethod.POST:
                return common_1.HttpStatus.CREATED;
            default:
                return common_1.HttpStatus.OK;
        }
    }
    setHeaders(response, headers) {
        headers.forEach(({ name, value }) => this.applicationRef.setHeader(response, name, value));
    }
    setStatus(response, statusCode) {
        this.applicationRef.status(response, statusCode);
    }
}
exports.RouterResponseController = RouterResponseController;
