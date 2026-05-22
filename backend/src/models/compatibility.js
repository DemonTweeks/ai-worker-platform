class QueryChain {
  constructor(promiseOrArray, isFindOne = false) {
    this.promise = Promise.resolve(promiseOrArray);
    this.isFindOne = isFindOne;
  }

  then(onFulfilled, onRejected) {
    let chainedPromise = this.promise;
    if (this.isFindOne) {
      chainedPromise = chainedPromise.then(val => {
        if (Array.isArray(val)) {
          return val.length > 0 ? val[0] : null;
        }
        return val;
      });
    }
    return chainedPromise.then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    return this.promise.finally(onFinally);
  }

  sort(sortObj) {
    this.promise = this.promise.then(items => {
      if (!items || !Array.isArray(items)) return [];
      const field = Object.keys(sortObj)[0];
      const direction = sortObj[field];
      return [...items].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];
        
        // Handle dates
        if (valA instanceof Date) valA = valA.getTime();
        else if (typeof valA === 'string' && !isNaN(Date.parse(valA))) valA = new Date(valA).getTime();
        
        if (valB instanceof Date) valB = valB.getTime();
        else if (typeof valB === 'string' && !isNaN(Date.parse(valB))) valB = new Date(valB).getTime();

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (valA < valB) return direction === -1 ? 1 : -1;
        if (valA > valB) return direction === -1 ? -1 : 1;
        return 0;
      });
    });
    return this;
  }

  skip(n) {
    this.promise = this.promise.then(items => {
      if (!items || !Array.isArray(items)) return [];
      return items.slice(n);
    });
    return this;
  }

  limit(n) {
    this.promise = this.promise.then(items => {
      if (!items || !Array.isArray(items)) return [];
      return items.slice(0, n);
    });
    return this;
  }

  select(fieldsObj) {
    this.promise = this.promise.then(items => {
      if (!items || !Array.isArray(items)) return [];
      const keys = Object.keys(fieldsObj).filter(k => fieldsObj[k] === 1);
      if (keys.length === 0) return items;
      return items.map(item => {
        const selected = {};
        keys.forEach(k => {
          selected[k] = item[k];
        });
        return selected;
      });
    });
    return this;
  }

  lean() {
    this.promise = this.promise.then(items => {
      if (!items) return items;
      if (Array.isArray(items)) {
        return items.map(item => (item.toJSON ? item.toJSON() : { ...item }));
      }
      return items.toJSON ? items.toJSON() : { ...items };
    });
    return this;
  }
}

const matchFilter = (item, filter) => {
  if (item && item.logicalDeleted === true) {
    return false;
  }
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or') {
      const matchesOr = value.some(subFilter => matchFilter(item, subFilter));
      if (!matchesOr) return false;
      continue;
    }

    if (key === '$and') {
      const matchesAnd = value.every(subFilter => matchFilter(item, subFilter));
      if (!matchesAnd) return false;
      continue;
    }

    const itemVal = item[key];

    if (value && typeof value === 'object') {
      if ('$gte' in value) {
        const valDate = new Date(itemVal);
        const filterDate = new Date(value.$gte);
        if (isNaN(valDate.getTime()) || isNaN(filterDate.getTime())) {
          if (itemVal < value.$gte) return false;
        } else {
          if (valDate < filterDate) return false;
        }
      }
      if ('$lte' in value) {
        const valDate = new Date(itemVal);
        const filterDate = new Date(value.$lte);
        if (isNaN(valDate.getTime()) || isNaN(filterDate.getTime())) {
          if (itemVal > value.$lte) return false;
        } else {
          if (valDate > filterDate) return false;
        }
      }
      if ('$ne' in value) {
        if (itemVal === value.$ne) return false;
      }
      if ('$exists' in value) {
        const exists = itemVal !== undefined && itemVal !== null;
        if (value.$exists !== exists) return false;
      }
      if ('$in' in value) {
        if (!value.$in.includes(itemVal)) return false;
      }
      continue;
    }

    if (value instanceof RegExp) {
      if (!value.test(itemVal)) return false;
      continue;
    }

    if (itemVal !== value) return false;
  }
  return true;
};

module.exports = {
  QueryChain,
  matchFilter
};
