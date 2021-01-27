#!/bin/bash

yarn install
yarn colect-data
cd csv
git add .
git git commit -m "`$date`" -m "covid"
git push
