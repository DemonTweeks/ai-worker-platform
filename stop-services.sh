#!/bin/bash

set -e

screen -S backend-server -X quit
screen -S frontend-preview -X quit
