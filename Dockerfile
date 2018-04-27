FROM node:8.11-slim

ENV DOCKERIZE_VERSION=v0.6.1 \
	HOSTNAME=cronicle-server \
	PORT=3012 \
	EMAIL_FROM=cronicle@esquel.com \
	SMTP_HOSTNAME=10.253.1.76


RUN \
	## install dockerize
	wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    ## install Cronicle
	&& curl -s https://raw.githubusercontent.com/jhuckaby/Cronicle/master/bin/install.js | node 

COPY source/ /opt/cronicle/ 

RUN cd /opt/cronicle \
    && chmod +x -R bin/*.sh

WORKDIR /opt/cronicle/

EXPOSE 3012

VOLUME [ "/opt/cronicle/conf" ]

CMD [ "sh", "/opt/cronicle/bin/endpoint.sh" ]

