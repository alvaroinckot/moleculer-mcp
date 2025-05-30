#!/usr/bin/env node

import { BridgeCli } from "../cli/BridgeCli";

const cli = new BridgeCli();
cli.run(process.argv);
