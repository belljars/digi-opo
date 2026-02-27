.PHONY: run build test check

run:
	./run_linux.sh

build:
	npm run build

test:
	python3 -m unittest discover -s tests -v

check:
	npm run check
	$(MAKE) test
	python3 -c "import webview; print('python backend imports: OK')"
