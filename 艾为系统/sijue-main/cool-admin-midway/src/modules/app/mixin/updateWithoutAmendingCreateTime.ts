function updateWithoutAmendingCreateTime(target: any) {
  target.prototype.update = async function () {


    const body: object | object[] = this.baseCtx.request?.body;


    let result = null;
    if (!Array.isArray(body)) {
      result = await this.service.update(body);
    } else {
      let promises = body.map((entity: any) => {
        return new Promise(async (resolve) => {
          await this.service.update(entity);
          resolve(`${entity?.id} updated`);
        });
      });
      result = await Promise.all(promises);
    }

    return this.ok(result);
  }
}

export default updateWithoutAmendingCreateTime;