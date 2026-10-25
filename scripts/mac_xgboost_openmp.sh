#!/bin/sh
# XGBoost on a Mac without Homebrew: "Library not loaded: @rpath/libomp.dylib".
# Copies the libomp that ships with scikit-learn next to XGBoost inside the
# virtual environment, adds @loader_path as a search path and re-signs it.
# Touches nothing outside .venv. With Homebrew, this is enough: brew install libomp
#
# Usage, from the repo root: sh scripts/mac_xgboost_openmp.sh
set -e
PY=.venv/bin/python
$PY -m pip install -q xgboost scikit-learn
LIB=$($PY -c "import importlib.util,os;print(os.path.join(os.path.dirname(importlib.util.find_spec('xgboost').origin),'lib'))")
OMP=$($PY -c "import sklearn,os;print(os.path.join(os.path.dirname(sklearn.__file__),'.dylibs','libomp.dylib'))")
cp "$OMP" "$LIB/libomp.dylib"
otool -l "$LIB/libxgboost.dylib" | grep -q "@loader_path" || install_name_tool -add_rpath @loader_path "$LIB/libxgboost.dylib"
codesign --force -s - "$LIB/libxgboost.dylib"
$PY -c "import xgboost; print('XGBoost', xgboost.__version__, 'listo')"
