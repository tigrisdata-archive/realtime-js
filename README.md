> ⚠️ **This repository is archived.**
>
> Tigris has pivoted from this database project to a new, globally distributed S3-compatible object storage service.
> Learn more about the new product here: https://www.tigrisdata.com/

# TigrisTypescript Realtime Client

## Api

```
const realtime = new RealTime({
      url: "ws://127.0.0.1:8084",
      project: "testproject",
    });

await realtime.once("connected");

const ch1 = realtime.getChannel("one");

ch1.subscribe("main", (msg) => {
    console.log("message rx", msg);
});

ch1.publish("main", "this is a message for channel 1");
```

## Building and Testing

```
# clean the dev env
npm run clean

# build
npm run build

# test
npm run test

```

## License

This software is licensed under the Apache 2.0.
