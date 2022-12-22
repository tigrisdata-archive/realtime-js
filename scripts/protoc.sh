#!/usr/bin/env bash
set -x
BASEDIR=$(dirname "$0")
cd "${BASEDIR}"/../

mkdir -p src/proto/

protoc --plugin=node_modules/ts-proto/protoc-gen-ts_proto \
  --ts_proto_opt=outputEncodeMethods=false \
  --ts_proto_out=./src/proto \
  --ts_proto_opt=outputServices=false \
  --ts_proto_opt=outputPartialMethods=false \
  -I ./api/proto/ \
  ./api/proto/server/v1/*.proto